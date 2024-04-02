/**
 * @NApiVersion 2.0
 * @NScriptType UserEventScript
*/

/* ************************************************************************
 * Company:     The Vested Group, www.thevested.com
 * Applies To:  Sales Order
 *
 *
 * HoT items shipping cost user event script develop for "Drybar - B2B" website.
 * Purpose -
 * 1) This script is used to set the shipping cost of HoT & Wave Items separately 
 *    HOT ITEM SHIPPING COST (custbody_hot_item_shipping_cost) & WAVE ITEM SHIPPING COST (custbody_wave_item_shipping_cost)
 ***********************************************************************/

define(['N/runtime', 'N/record', 'N/log', 'N/search'], function (runtime, record, log, search) {

    function beforeSubmit(context) {
        if (context.type == context.UserEventType.CREATE && runtime.executionContext == "USERINTERFACE") {
            var newSOObj = context.newRecord;
            var currentShipState = newSOObj.getValue({fieldId:'shipstate'});
            var arrItems = [];
            var isHoTShipItem = false;
            var hotItemsShippingCost = 0;
            
            var lineItemCnt = newSOObj.getLineCount('item');

            for(var i=0; i<lineItemCnt; i++){
                arrItems.push( newSOObj.getSublistValue({sublistId: 'item', fieldId: 'item', line: i}) );
            }
            var arrSOItems = getSOItemDetails(arrItems);

            if(arrSOItems.length > 0) {
                var customShipMethods = getHoTShippingItem(currentShipState);

                for(var j=0; j<arrSOItems.length; j++) {
                    if(arrSOItems[j].waveHoTDropShip) { isHoTShipItem = true; break; }
                }

                if(isHoTShipItem && customShipMethods && customShipMethods.length > 0 && currentShipState) {
                    for(var i=0; i<lineItemCnt; i++) {
                        var itemQuantity = newSOObj.getSublistValue({sublistId: 'item', fieldId: 'quantity', line: i});
                        var objItemDetails = getItemDetails(arrSOItems, newSOObj.getSublistValue({sublistId: 'item', fieldId: 'item', line: i}));

                        if(objItemDetails) {
                            var itemWeight = objItemDetails.weight || 0;
                            var itemQtyWeight = (itemWeight * itemQuantity);
                            var itemWeightUnit = objItemDetails.weightUnit || "lb";
                            var itemWaveHoT = objItemDetails.waveHoTDropShip;
							
                            if( itemWaveHoT && itemWeight && itemWeightUnit && itemWeight>0 ) {
                                hotItemsShippingCost = Number( hotItemsShippingCost ) + Number (getHoTShippingCost(customShipMethods[0], itemQtyWeight, itemWeightUnit) );
                            }
                        }
                    }

                    var waveItemShippingCost = Number(newSOObj.getValue({fieldId: 'shippingcost'})) || 0;
                    var finalShippingCost = Number(waveItemShippingCost)+Number(hotItemsShippingCost);

                    newSOObj.setValue('custbody_wave_item_shipping_cost', waveItemShippingCost);

                    if(Number(hotItemsShippingCost)>=0) {
                        newSOObj.setValue('custbody_hot_item_shipping_cost', hotItemsShippingCost);                            
                    }
                    newSOObj.setValue('shippingcost', finalShippingCost);
                }
            }
        }
    }

    function getItemDetails(objItems, itemInternalId) {
        if(objItems && itemInternalId) {
            for(var i=0; i<objItems.length; i++){
                if(objItems[i].internalId == itemInternalId) { return objItems[i]; }
            }
        }
    }

    function getSOItemDetails(arrItems) {
        var items = [];
        if(arrItems && arrItems.length>0) {
            try {
                var objItems = search.create({
                    type: "item",
                    columns: [{name: 'internalid'}, {name: 'custitem_wave_hot_drop_ship'}, {name: 'weight'}, {name: 'weightunit'}],
                    filters: [{name: 'internalid', operator: 'anyof', values: arrItems}]
                });

                objItems.run().each(function(result){
                    items.push({
                        internalId: result.getValue({name: 'internalid'}),
                        waveHoTDropShip: result.getValue({name: 'custitem_wave_hot_drop_ship'}), 
                        weight: result.getValue({name: 'weight'}),
                        weightUnit: result.getText({name: 'weightunit'})
                    });
                    return true;
                });
            }
            catch (err) {
                log.debug("DEBUG", "ERROR IN getSOItemDetails: "+JSON.stringify(err));
            }
        }
        return items;
    }

    function getHoTShippingCost(objHoTShipMethod, weight, weightUnit) {
        // [{"value":"1","text":"lb"},{"value":"2","text":"oz"},{"value":"3","text":"kg"},{"value":"4","text":"g"}]
        var shippingCost = 0;

        switch (weightUnit)
        {
            case "lb":
                shippingCost = Number(objHoTShipMethod.ship_price) * Number(weight);
                break;
            case "oz":
                //lb=oz*0.0625
                shippingCost = Number(objHoTShipMethod.ship_price) * (Number(weight) * Number(0.0625));
                break;
            case "kg":
                //lb=kg*2.2046
                shippingCost = Number(objHoTShipMethod.ship_price) * (Number(weight) * Number(2.2046));
                break;
            case "g":
                //lb=g*0.0022046
                shippingCost = Number(objHoTShipMethod.ship_price) * (Number(weight) * Number(0.0022046));
                break;
            default:
                shippingCost = Number(objHoTShipMethod.ship_price) * Number(weight);
                break;
        }

        var shippingBuffer = getHoTShippingBuffer() || 0;//Configuration.get('hotItemShippingMethod.shippingBuffer');

        if(shippingCost && shippingCost>0 && shippingBuffer && shippingBuffer!=0)
        {
            shippingBuffer = parseInt(shippingBuffer,10);
            shippingCost = shippingCost + (shippingCost * (shippingBuffer/100));
        }
        
        return shippingCost.toFixed(2);
    }

    function getHoTShippingBuffer() {
        var hotBuffer = 0;
        try{
            var objSCConfig = record.load({type: 'customrecord_ns_sc_configuration', id: '2'}); // Change SCConfig record Id per Production (id: 2) & Sandbox (id: 7) instance

            if(objSCConfig) {
                var objConfig = JSON.parse(objSCConfig.getValue("custrecord_ns_scc_value"));
                hotBuffer = objConfig.hotItemShippingMethod.shippingBuffer;
            }
        }
        catch(err){
            log.debug("Catch ERROR in getHoTShippingBuffer", JSON.stringify(err));
        }
        return hotBuffer;
    }

    function getHoTShippingItem(currentShipState) {
        var hotShippingItems = [];
        try {
            var objHoTShippingItems = search.create({
                type: 'customrecord_wave_hot_ship_info_state',
                columns: [{name: 'internalid'},{name: 'custrecord_wave_hot_ship_web_name'},{name: 'custrecord_wave_hot_ship_state'},{name: 'shortname', join: 'CUSTRECORD_WAVE_HOT_SHIP_STATE'},{name: 'custrecord_wave_hot_ship_price'}],
                filters: [{name: 'isinactive', operator: 'is', values: 'F'}]
            }); 
    
            objHoTShippingItems.run().each(function(result) {
                if(currentShipState == result.getValue({name: 'shortname', join: 'CUSTRECORD_WAVE_HOT_SHIP_STATE'})) {
                    hotShippingItems.push({
                        internalid: result.getValue({name: 'internalid'}), 
                        ship_name: result.getValue({name: 'custrecord_wave_hot_ship_web_name'}), 
                        ship_state: result.getValue({name: 'shortname', join: 'CUSTRECORD_WAVE_HOT_SHIP_STATE'}),
                        ship_price: result.getValue({name: 'custrecord_wave_hot_ship_price'})
                    }); 
                }
                return true;
            });
        } catch(err) {
            log.debug("ERROR: ", "Error in getHoTShippingItem: "+JSON.stringify(err));
        }
        
        return hotShippingItems;
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
