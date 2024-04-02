/* eslint-disable no-redeclare */
/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */

/* ************************************************************************
 * Company:     The Vested Group, www.thevested.com
 * Applies To:  Sales order
 *
 *
 * Suitelet script develop for Grand Opening Order extension of WAVE sub-domains.
 * Purpose -
 * 1) To save the customer notes on the line items
 * 
 ***********************************************************************/

define(['N/record', 'N/log'],
    function (record, log) {
        function onRequest(context) {
            var action	= context.request.parameters.action;
            
            if(action == "addnotes")	{addItemNotes(context);}
        }

        function addItemNotes(context) {
            var reqBody = JSON.parse(context.request.body);
            var lineItemNotes = reqBody.lineitemnotes;
            var transId = context.request.parameters.transid;

            if(transId && lineItemNotes){			
                try{
                    var objTransaction = record.load({type: 'salesorder', id: transId, isDynamic: false});
                    var lineCnt = objTransaction.getLineCount({ sublistId: 'item' });
                    for(var i=0; i<lineCnt; i++) {
                        var objLine = null;
                        var itemId = objTransaction.getSublistValue({sublistId: 'item', fieldId: 'item', line: i});
                        for(var j=0; j<lineItemNotes.length; j++){
                            var line = lineItemNotes[j];
                            if(line.internalid == itemId){ 
                                objLine = line;
                                break;
                            }
                        }

                        if( objLine != null ){
                            objTransaction.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_wave_nso_customer_notes',
                                value: objLine.notes,
                                line: i
                            });
                        } else {
                            objTransaction.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_wave_nso_customer_notes',
                                value: "",
                                line: i
                            });
                        }
                    }

                    objTransaction.setValue('custbody_wave_nso_in_cust_review', false);
                    objTransaction.setValue('custbody_wave_nso_cust_notes_submitted', true);

                    var recordId = objTransaction.save();
                    context.response.write( JSON.stringify({success: true, message: ""}) );
                } catch(err){
                    log.debug("IN CATCH ERROR-: "+itemId,JSON.stringify(err));
                    context.response.write( JSON.stringify({success: false, message: err.message}) );
                }
            }
        }

        return {
            onRequest : onRequest
        };
    }
);
