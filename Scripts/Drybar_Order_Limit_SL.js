/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */

/* ************************************************************************
 * Company:     The Vested Group, www.thevested.com
 * Applies To:  Sales Order
 *
 *
 * Order limit calculation Suitelet script develop for "Drybar - B2B" website.
 * Purpose -
 * 1) Approve & Reject the Sales Order from My Account  
 * 
 ***********************************************************************/

define(['N/record', 'N/runtime', 'N/search', 'N/render', 'N/email', 'N/log'],
    function (record, runtime, search, render, email, log) {
        function onRequest(context) {
            var action	= context.request.parameters.action;

            if(action == "approve")	{approveOrder(context);}
            if(action == "reject") {rejectOrder(context);}
        }

        function approveOrder(context) {
            var soId = context.request.parameters.soid;
            var isApproved = "fail";

            if(soId) {
                try {
                    record.submitFields({type: 'salesorder', id: soId, values: {orderstatus: 'B'} });
                    isApproved = "success";
                } catch (err) {
                    log.debug('Error in Catch : approveOrder', 'ERR: ' + err.message);
                }
            }

            var jsonObj = {};
            jsonObj["status"]  = isApproved;
            context.response.write( JSON.stringify(jsonObj) );
        }

        function rejectOrder(context) {
            var soId = context.request.parameters.soid;
            var isRejected = "fail";

            if(soId) {
                try {
                    // Change order status to Closed
                    var closedItemAmount = 0;
                    var objSo = record.load({type: 'salesorder', id: soId}); // , isDynamic: true
                    var lineCnt = objSo.getLineCount({ sublistId: 'item' });
                    for(var i=0; i<lineCnt; i++) {
                        var isClosed = objSo.getSublistValue({sublistId: 'item', fieldId: 'isclosed', line: i});
                        if(!isClosed) {
                            objSo.setSublistValue({sublistId: 'item', fieldId: 'isclosed', line: i, value: true});
                            closedItemAmount += objSo.getSublistValue({sublistId: 'item', fieldId: 'amount', line: i});
                        }
                    }
                    objSo.save({enableSourcing: true, ignoreMandatoryFields: true});
                    // Deduct the closed item(s) amount from Customer's Monthly Order Amount 
                    var subTotal = objSo.getValue({fieldId: 'subtotal'});
                    var customerId = objSo.getValue({fieldId: 'entity'});
                    var tranDate = objSo.getValue({fieldId: 'trandate'});
                    var tranMonth = tranDate.getMonth();
                    var currentDate = new Date();
                    var currentMonth = currentDate.getMonth();

                    var objCustomer = record.load({type: 'customer', id: customerId});
                    var monthOrderAmt = objCustomer.getValue({fieldId: 'custentity_wave_month_order_amt'});

                    if(closedItemAmount > 0 && tranMonth == currentMonth && monthOrderAmt > 0 && monthOrderAmt > closedItemAmount) {
                        var updatedMonthOrderAmt = Number(monthOrderAmt) - Number(closedItemAmount); 
                        objCustomer.setValue({fieldId: "custentity_wave_month_order_amt", value: updatedMonthOrderAmt});
                        objCustomer.save({enableSourcing: true, ignoreMandatoryFields: true});
                    }

                    isRejected = "success";
                } catch (err) {
                    log.debug('Error in Catch : rejectOrder:', 'ERR: ' + err.message);
                }
            }

            var jsonObj = {};
            jsonObj["status"]  = isRejected;
            context.response.write( JSON.stringify(jsonObj) );
        }

        return {
            onRequest : onRequest
        };
    });
