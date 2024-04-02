/**
 * @NApiVersion 2.0
 * @NScriptType UserEventScript
*/

/* ************************************************************************
 * Company: The Vested Group, www.thevested.com
 * Applies To: Item Record
 *
 *
 * Purpose -
 * 1) Update the parent item's "SHOW PARENT ITEM BADGES" field if all child items "SHOW ITEM BADGES" field is checked.
 ***********************************************************************/

define(['N/runtime', 'N/record', 'N/https', 'N/url', 'N/log', 'N/search'], function (runtime, record, https, url, log, search) {
    function afterSubmit(context) {
        var newRecObj = context.newRecord;
        var recType = newRecObj.type;
        if (recType == "inventoryitem" && (context.type == context.UserEventType.CREATE || context.type == context.UserEventType.EDIT)) {
            var arrItems = [];
            //var internalId = newRecObj.getValue({fieldId: 'internalid'});
            var hasParent = newRecObj.getValue({fieldId: 'hasparent'});
            var parentId = newRecObj.getValue({fieldId: 'parent'});

            if(hasParent && parentId) {
                try {
                    var oSearch = search.create({
                        type: recType, 
                        columns: [
                            {name: 'custitem_ns_ib_show_badges'},
                            {name: 'custitem_ns_ib_badges'}
                        ], 
                        filters: [["parent", "is", parentId], "AND", ["isonline", "is", "T"]]
                    });
                    var checkShowParentBadges = "";
                    oSearch.run().each(function(result){
                        arrItems.push( result.getValue({name: 'custitem_ns_ib_show_badges'}) );
                        return true;
                    });
                    
                    if(arrItems.indexOf(false) != -1) {
                        checkShowParentBadges = false;
                    } else {
                        checkShowParentBadges = true;
                    }

                    record.submitFields({
                        type: recType,
                        id: parentId,
                        values: {
                            'custitem_wave_show_parent_item_badge': checkShowParentBadges
                        }
                    });
                } catch (err) {
                    log.debug("DEBUG", "IN CATCH: afterSubmit: "+JSON.stringify(err));
                }
            }
        }
    }

    return {
        afterSubmit: afterSubmit
    };
});
