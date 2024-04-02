/**
 * @NApiVersion 2.0
 * @NScriptType UserEventScript
*/

/* ************************************************************************
 * Company:     The Vested Group, www.thevested.com
 * Applies To:  Sales Order
 *
 *
 * Order limit calculation user event script develop for "Drybar - B2B" website.
 * Purpose -
 * 1) Update the Monthly Order Amount (custentity_wave_month_order_amt) 
 *    cutom entity field after submit Sales Order
 * 2) Update Monthly Exceeded Amount (custbody_wave_monthly_exceeded_amt) 
 *    after submit Sales Order
 * 3) Send pending order email to Order Approver
 ***********************************************************************/

define(['N/runtime', 'N/record', 'N/log', 'N/email', 'N/search', 'N/format'], function (runtime, record, log, email, search, format) {
    function afterSubmit(context) {
        var newRecObj = context.newRecord;
        var soId = newRecObj.id;

        if(soId && soId != "") {
            var objSo = record.load({type: 'salesorder', id: soId});
            var soNumber = objSo.getValue({fieldId: "tranid"});
            var customerId = objSo.getValue({fieldId: "entity"}); //newRecObj.getValue({fieldId: 'entity'});
			var sourceDomain = objSo.getValue({fieldId: "custbody_source_domain"});
            log.debug("soId: "+soId," || soNumber: "+soNumber + "|| runtime.executionContext: "+runtime.executionContext+" || "+customerId+" || context.type: "+context.type+" || trandate: "+objSo.getValue({fieldId: "trandate"}));
            
            // Customer details
            var objCustomer = record.load({type: 'customer', id: customerId});
            var isMonthOrderRestriction = objCustomer.getValue({fieldId: 'custentity_wave_month_order_restriction'});
            var monthOrderLimit = objCustomer.getValue({fieldId: 'custentity_wave_month_order_limit'});
            var monthOrderAmt = objCustomer.getValue({fieldId: 'custentity_wave_month_order_amt'});

            if(isMonthOrderRestriction && monthOrderLimit != "") {
                if (runtime.executionContext == "WEBSTORE" && context.type == "create") {
                    var monthlyExceededAmt = 0;
                    var subTotal = objSo.getValue({fieldId: 'subtotal'});

                    // Update Monthly Order Amount on Customer record
                    try {
                        monthOrderAmt += subTotal;
                        objCustomer.setValue({fieldId: "custentity_wave_month_order_amt", value: monthOrderAmt});
                        objCustomer.save({enableSourcing: true, ignoreMandatoryFields: true});
                    } catch (err) {
                        log.debug("DEBUG", "IN CATCH: Update Monthly Order Amount: "+JSON.stringify(err));
                    }

                    // Update Monthly Exceeded Amount on Sales Order and if exceeded send email to all SO Approvers
                    try {
                        if(monthOrderAmt > monthOrderLimit) { 
                            monthlyExceededAmt = Number(monthOrderAmt) - Number(monthOrderLimit);
                            record.submitFields({
                                type: 'salesorder',
                                id: soId,
                                values: {custbody_wave_monthly_exceeded_amt: monthlyExceededAmt}
                            });

                            // Send email
                            sendPendingOrderEmail(objCustomer, soNumber, soId, sourceDomain);
                        }
                    } catch (err) {
                        log.debug("DEBUG", "IN CATCH: Update Monthly Exceeded Amount: "+JSON.stringify(err));
                    }
                }

                // Edit mode - if SO items are CLOSED, deduct the order subtotal from Customer's Monthly Order Amount
                //if ( (context.type == "edit" && runtime.executionContext == "USERINTERFACE") || ((context.type == "xedit" || context.type == "edit") && runtime.executionContext == "MAPREDUCE")) {
                if (context.type == context.UserEventType.EDIT && runtime.executionContext == "USERINTERFACE") {
                    var lineCnt = objSo.getLineCount('item');
                    var closedItemAmount = 0;
                    for(var i=0; i<lineCnt; i++){
                        var isClosed = objSo.getSublistValue({sublistId: 'item', fieldId: 'isclosed', line: i});
                        if(isClosed) {
                            closedItemAmount += objSo.getSublistValue({sublistId: 'item', fieldId: 'amount', line: i});
                        }
                    }

                    try {
                        //var tranDate = format.parse({value: objSo.getValue({fieldId: "trandate"}), type: format.Type.DATE});
                        var tranMonth = objSo.getValue({fieldId: "trandate"}).getMonth();
                        var currentDate = new Date();
                        var currentMonth = currentDate.getMonth();
                        
                        if(closedItemAmount > 0 && tranMonth == currentMonth && monthOrderAmt > 0 && monthOrderAmt > closedItemAmount) {
                            var updatedMonthOrderAmt = Number(monthOrderAmt) - Number(closedItemAmount); 
                            objCustomer.setValue({fieldId: "custentity_wave_month_order_amt", value: updatedMonthOrderAmt});
                            objCustomer.save({enableSourcing: true, ignoreMandatoryFields: true});
                            log.debug("DEBUG", "EDIT => updatedMonthOrderAmt=> "+updatedMonthOrderAmt);
                        }
                        log.debug("DEBUG", tranMonth+" || tranMonth => closedItemAmount=> "+closedItemAmount);
                    } catch (err) {
                        log.debug("DEBUG", "IN CATCH: Update Monthly Order Amount: "+JSON.stringify(err));
                    }
                }
            }
        }
    }

    function sendPendingOrderEmail(objCustomer, soNumber, soId, sourceDomain) {
        if(objCustomer) {
            try {
                var lineCnt = objCustomer.getLineCount({ sublistId: 'contactroles' });
            
                for(var i=0; i<lineCnt; i++) {
                    var contactName = objCustomer.getSublistValue({sublistId: 'contactroles', fieldId: 'contactname', line: i});
                    var contactEmail = objCustomer.getSublistValue({sublistId: 'contactroles', fieldId: 'email', line: i});
                    var internalId = objCustomer.getSublistValue({sublistId: 'contactroles', fieldId: 'contact', line: i});

                    var objContact = search.lookupFields({
                        type: search.Type.CONTACT,
                        id: internalId,
                        columns: ['custentity_wave_order_limit_approver']
                    });

                    if(objContact) {
                        var isLimitApprover = objContact.custentity_wave_order_limit_approver;
                        if(isLimitApprover) {
                            var config = getEmailConfiguration(sourceDomain);

                            var template = record.load({type: 'emailtemplate', id: config.emailTemplateId});
                            var content	= template.getValue({fieldId: 'content'});
                            var soLink = config.siteURL+"/sca-dev-2020-2-0/my_account.ssp#purchases/view/salesorder/"+soId;
							if(sourceDomain == "13") soLink = config.siteURL+"/elements-massage/my_account.ssp#purchases/view/salesorder/"+soId;

                            content = content.replace("#@#CONTACT_NAME#@#", contactName);
                            content = content.replace("#@#SALES_ORDER_NO#@#", soNumber);
                            content = content.replace("#@#WEB_SO_LINK#@#", soLink);
                            content = content.replace("#@#APPROVE_LINK#@#", soLink);
                            content = content.replace("#@#REJECT_LINK#@#", soLink);
                            content = content.replace(/#@#WEBSITE_URL#@#/gi, config.siteURL);

                            email.send({
                                author: -5,
                                recipients: contactEmail,
                                subject: template.getValue({fieldId: 'subject'}),
                                body: content
                            });
                        }
                    }
                }
            } catch (err) {
                log.debug('Error in Catch : sendPendingOrderEmail', 'ERR: ' + err.message);
            }
        }
    }

    function getEmailConfiguration(sourceDomain) {
		var objConfig = {emailTemplateId: "255", siteURL: "https://drybar.wave.store"};

		if(sourceDomain == "10")
			objConfig = {emailTemplateId: "255", siteURL: "https://drybar.wave.store"};
		else if(sourceDomain == "13")
			objConfig = {emailTemplateId: "257", siteURL: "https://elementsmassage.wave.store"};

		return objConfig;
    }

    return {
        afterSubmit: afterSubmit
    };
});
