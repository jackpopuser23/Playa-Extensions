/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search', 'SuiteScripts/TVG Scripts/Common Libraries/Utils.js'],
/**
 * @param {record} record
 * @param {search} search
 * @param {SuiteScripts/TVG Scripts/Common Libraries/Utils.js} utils
 */
    function(record, search, utils) {
        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} context
         * @param {Record} context.newRecord - New record
         * @param {Record} context.oldRecord - Old record
         * @param {string} context.type - Trigger type
         * @Since 2015.2
         */
        function afterSubmit(context) {
            log.debug("afterSubmit - context",context);
            try{
                if (context.type == context.UserEventType.CREATE || context.type == context.UserEventType.EDIT) {
                    log.debug('afterSubmit - if',context.type);
                    var newRec = context.newRecord;

                    // get Sales Order Internal Id from created from field
                    var salesOrderID = newRec.getValue('createdfrom');
                    log.debug('afterSubmit - salesOrderID',salesOrderID);

                    // the source of where this came from
                    var source = newRec.getValue('source');
                    log.debug('afterSubmit - source',source);

                    //The user event script will only trigger for cash sales with a ‘Source’ of Web (Drybar (B2B)).
                    if((source == 'Web (Drybar Store)' || source == 'Web (Drybar (B2B))' || source == 'Web (Wellness & Vitality Exchange B2B)') && salesOrderID){
                        //When Oracle pushes a Helen of Troy item fulfillment into NetSuite, 
                        //Oracle will check the ‘HoT Fulfillment’ (custbody_hot_fulfillment) checkbox as TRUE. 
                        //This will allow end-users and development to identify Helen of Troy-specific item fulfillments. 
                        //This checkbox will only be marked as TRUE for a Helen of Troy item fulfillment.
                        var itemFullFillmentSearch = search.create({
                            'type': "itemfulfillment",
                            'filters': [ 
                                ["type","anyof","ItemShip"], 
                                "AND", 
                                ["custbody_db_so_cs_internalid","anyof",salesOrderID], 
                                "AND", 
                                ["mainline","is","T"], 
                                "AND", 
                                ["custbody_hot_fulfillment","is","T"]
                            ],
                            columns:
                            [
                                search.createColumn({name: "tranid", label: "Document Number"}),
                                search.createColumn({name: "entity", label: "Name"}),
                                search.createColumn({name: "custbody_hot_fulfillment", label: "HoT Fulfillment"}),
                                search.createColumn({name: "custbody_db_so_cs_internalid", label: "Sales Order/Cash Sale Internal Id"})
                            ]
                        });
        
                        // getting the search results from the search
                        var itemFullFillmentResults = utils.executeSearch(itemFullFillmentSearch);
                        log.debug('afterSubmit - itemFullFillmentResults', JSON.stringify(itemFullFillmentResults));
        
                        //This is a HoT item fullfillment
                        if (itemFullFillmentResults.length) {
                            // the user event script will validate that the respective cash sale 
                            // is for Helen of Troy (HoT) items only by looping through the cash sale line items
                            // and verifying that all items are marked as YES for the 
                            // ‘HoT Item’ (custcol_wave_hot_item) transaction column field.
                            var allCashSaleLinesAreHot = 1;
                            // Looping through the item fullfillment item sublist
                            var newRecLineCount = newRec.getLineCount('item');
                            log.debug('afterSubmit - newRecLineCount',newRecLineCount);

                            for (var i = 0; i < newRecLineCount; i++) {
                                var hotItem = newRec.getSublistValue('item', 'custcol_wave_hot_item', i);
                                //04.29.2022 -  Chris Mixon - Case: 39195
                                //There is an issue where unfulfilled non-HOT items are included on the cash sale with a quantity of 0
                                //  This logic only considers a non-HOT item if it has a non-zero quantity.
                                var qty     = newRec.getSublistValue('item', 'quantity',              i);
                                log.debug('afterSubmit - hotItem, qty', hotItem + ', ' + qty);
                                if(!hotItem && qty != 0){
                                    allCashSaleLinesAreHot = 0;
                                    return; //no action required, per Joe Lang
                                }
                            }
                            //If the following criteria is met, the User Event script will run and close Sales Order item lines:
                            //1. Cash Sale ‘Source’ = Web (Drybar (B2B)) (Note: This is checked above)
                            //2. All items are marked as YES for the ‘HoT Item’ column checkbox custom field.
                            if(allCashSaleLinesAreHot){
                                log.debug('afterSubmit - allCashSaleLinesAreHot', allCashSaleLinesAreHot);

                                //the User Event script will navigate to the Sales Order identified in the ‘Created From’ field.
                                var salesOrderRec = record.load({
                                    type : "salesorder",
                                    id : salesOrderID,
                                    isDynamic : true
                                });

                                log.debug('afterSubmit - salesOrderRec', salesOrderRec);

                                var salesOrderLineCount = salesOrderRec.getLineCount({sublistId: 'item'});

                                var recordUpdated = false;
                                for(i = 0; i < salesOrderLineCount; i++){
                                    salesOrderRec.selectLine({
                                        sublistId: 'item',
                                        line:	  i
                                    });

                                    var isHotItem = salesOrderRec.getCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId:   'custcol_wave_hot_item'
                                    });
                                    log.debug('afterSubmit', 'salesorder: '+ salesOrderID + ' i: ' + i + ' isHotItem: ' + isHotItem);

                                    //The User Event script will then close all of the Helen of Troy (HoT) items on the Sales Order.
                                    //Please note, closing fulfilled or partially fulfilled items will have no downstream effect on Purchase History (ERP and/or SCA), billing, or recommended order.
                                    if(isHotItem){
                                        log.debug('afterSubmit - setting isclosed to true', 'salesorder: '+ salesOrderID + ' i: ' + i + ' isHotItem: ' + isHotItem);
                                        salesOrderRec.setCurrentSublistValue({
                                            sublistId: 'item',
                                            fieldId:   'isclosed',
                                            value:	   true
                                        });
                                        salesOrderRec.commitLine({sublistId: 'item'});
                                        recordUpdated = true;
                                    }
                                }
                                if(recordUpdated){
                                    log.debug('afterSubmit - before save');
                                    if(salesOrderRec.getValue("status") != "Closed"){updateMonthlyOrderAmt(salesOrderRec, itemFullFillmentResults);}
                                    salesOrderRec.save({ignoreMandatoryFields: true});
                                    log.debug('afterSubmit - after save');
                                }
                            }
                        }
                    }
                }
            } catch (e){
                var msg = '';

                if (e.hasOwnProperty('message')) {
                    msg = e.name + ': ' + e.message + ': ' + e.stack;
                    log.error('getInputData - EXPECTED_ERROR', msg);
                    log.error('getInputData - stack', e.stack);
                } else {
                    msg = e.toString() + ': ' + e.stack;
                    log.error('getInputData - UNEXPECTED_ERROR', msg);
                    log.error('getInputData - stack', e.stack);
                }
                if (msg){
                    // update error field
                    record.submitFields({
                        type: context.newRecord.type, 
                        id:   context.newRecord.id, 
                        values: {"custbody_hot_unfulfilled_script_error": msg},
                        options: {
                            enablesourcing: true,
                            ignoreMandatoryFields: true
                        }
                    });
                }
            }
        }

        function updateMonthlyOrderAmt(objSo, itemFullFillmentResults) {
            var customerId = objSo.getValue({fieldId: "entity"});
            var objCustomer = record.load({type: 'customer', id: customerId});
            var isMonthOrderRestriction = objCustomer.getValue({fieldId: 'custentity_wave_month_order_restriction'});
            var monthOrderLimit = objCustomer.getValue({fieldId: 'custentity_wave_month_order_limit'});
            var monthOrderAmt = objCustomer.getValue({fieldId: 'custentity_wave_month_order_amt'});
            var tranMonth = objSo.getValue({fieldId: "trandate"}).getMonth();
            var currentDate = new Date();
            var currentMonth = currentDate.getMonth();

            if(isMonthOrderRestriction && monthOrderLimit != "" && tranMonth == currentMonth && monthOrderAmt > 0) {
                var arrFulfillItems = [];
                // Get fulfilled items
                for(var i=0; itemFullFillmentResults != null && i < itemFullFillmentResults.length; i++) {
                    var result = itemFullFillmentResults[i];
                    var objIF = record.load({type: 'itemfulfillment', id: result.id});
                    var lineCnt = objIF.getLineCount({sublistId: 'item'});
                    for(var j=0; objIF!=null && j<lineCnt; j++) {
                        var itemId = objIF.getSublistValue('item', 'item', j);
                        arrFulfillItems.push(itemId);
                    }
                }

                // Get only closed item(s) amount from sales order
                var closedItemAmount = 0;
                var soLineItemCnt = objSo.getLineCount("item");
                for(var k=0; k<soLineItemCnt; k++) {
                    var itemId = objSo.getSublistValue('item', 'item', k);
                    if(arrFulfillItems.indexOf(itemId) == -1) {
                        var amount = objSo.getSublistValue('item', 'amount', k);
                        closedItemAmount += amount;
                    }
                }

                if(closedItemAmount > 0) {
                    //log.debug("DEBUG", "tranMonth: "+tranMonth+" || closedItemAmount=> "+closedItemAmount+" || monthOrderAmt=> "+monthOrderAmt);
                    try {                      
                        if(monthOrderAmt > 0 && monthOrderAmt > closedItemAmount) {
                            var updatedMonthOrderAmt = Number(monthOrderAmt) - Number(closedItemAmount); 
                            objCustomer.setValue({fieldId: "custentity_wave_month_order_amt", value: updatedMonthOrderAmt});
                            objCustomer.save({enableSourcing: true, ignoreMandatoryFields: true});
                            log.debug("DEBUG", "CASH SALE => updateMonthlyOrderAmt=> "+updatedMonthOrderAmt);
                        }
                    } catch (err) {
                        log.debug("DEBUG", "IN CATCH: CASH SALE: updateMonthlyOrderAmt: "+JSON.stringify(err));
                    }
                }
            }
        }

        return {
            afterSubmit: afterSubmit
        };
    });
