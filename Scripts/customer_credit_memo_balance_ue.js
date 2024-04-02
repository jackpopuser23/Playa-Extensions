"use strict";

/* ***********************************************************************
 * This User event script includes below functionality
 *
 *  Applied in the Credit Memo record - after submit
 *  Calculate the total available/unapplied credit associated to the customer and save it on custom entity field
 *		- Available Credit Memo Balance {custentity_wave_available_cm_balance}
 *
 * Version    Date             Author        Remarks
 * 1.00       29 June 2023     Amol			 Initial commit
 ***********************************************************************/

/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
*/

define(['N/log','N/record','N/runtime','N/https','N/search'],
    function (log,record,runtime,https,search) {
        /**
         * Function definition to be triggered before record is loaded.
         * @param {Object} context
         * @param {Record} context.newRecord - New record
         */
        function afterSubmit(context) {
            try {
                var currentRecord = context.newRecord;
                var customerId = "";
                if(currentRecord.type == 'creditmemo')  {
                    customerId = currentRecord.getValue({fieldId: 'entity'});
                } else {
                    customerId = currentRecord.getValue({fieldId: 'customer'});
                }
                var amountTotal = 0;
                if(customerId) {
                    var creditmemoSearchObj = search.create({
                        type: "creditmemo",
                        filters:
                        [
                            ["customer.internalidnumber","equalto",customerId], 
                            "AND", 
                            ["status","anyof","CustCred:A"], 
                            "AND", 
                            ["mainline","is","T"], 
                            "AND", 
                            ["amountremainingisabovezero","is","T"]
                        ],
                        columns:
                        [
                            search.createColumn({
                                name: "entity",
                                summary: "GROUP"
                            }),
                            search.createColumn({
                                name: "amountremaining",
                                summary: "SUM"
                            })
                        ]
                    });
                    creditmemoSearchObj.run().each(function(result){
                        amountTotal = result.getValue({name: 'amountremaining', summary: search.Summary.SUM});
                        return true;
                    });
                    
                    record.submitFields({
                        type: "customer",
                        id: customerId,
                        values: {'custentity_wave_available_cm_balance': amountTotal}
                    });
                    //log.debug("DEBUG", "Record type: "+currentRecord.type+" || customerId: "+customerId+" || In Submit - amountTotal: "+amountTotal);
                }
            } catch (error) {
                log.debug("Error:", error );
            }
        }

        return {
            afterSubmit: afterSubmit
        };
    }
);