/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */

define(['N/record', 'N/runtime', 'N/search', 'N/render', 'N/email', 'N/log', 'N/https', 'N/url'],
    function (record, runtime, search, render, email, log, https, url) {
        function onRequest(context) {
            var action	= context.request.parameters.action;
            //log.debug("action: "+action,JSON.stringify(context.request.parameters));
            if(action == "getshippingaddr")	{getAllShippingAddress(context);}
            if(action == "contactassignment") {getContactAssignments(context);}
            if(action == "getcontactlist") {getContactList(context);}
            if(action == "updateaction") {updateContact(context);}
            if(action == "deletecontact") {deleteContact(context);}
        }

        function deleteContact(context) {
            var contactId = context.request.parameters.contactid;
            var result = "";

            if(contactId) {
                try {
                    var contactSearchObj = search.create({
                        type: "contact",
                        filters: [["customer.internalidnumber","greaterthan","0"], "AND", ["internalidnumber","equalto",contactId]],
                        columns: [search.createColumn({name: "internalid", join: "customer"})]
                    });

                    var searchResultCount = contactSearchObj.runPaged().count;
                    if(searchResultCount == 1) {
                        // Delete contact 
                        try {
                            record.delete({type: 'contact', id: contactId});
                            result = {'status': 'success'};
                        } catch (err) {
                            log.debug('Error in Catch : deleteContact: record.delete', 'ERR: ' + err.message);
                            result = {'status': 'fail'};
                        }
                    } else {
                        result = {'status': 'fail'};
                    }
                } catch (err) {
                    log.debug('Error in Catch : deleteContact', 'ERR: ' + err.message);
                    result = {'status': 'fail'};
                }
            }

            var jsonObj = {};
            jsonObj["result"]  = [result];
            context.response.write( JSON.stringify(jsonObj) );
        }

        function updateContact(context) {
            var customersToAttach = context.request.parameters.subscriptionid;
            var customersToDetatach = context.request.parameters.nonsubscriptionid;
            var contactId = context.request.parameters.contactid;
            var customerId = context.request.parameters.customerid;
            var isCreate = context.request.parameters.iscreate;
            var isUpdated = 'success';

            if(contactId && customersToAttach) {
                var arrAttachCustomer = customersToAttach.split(",");
                for(var i=0; arrAttachCustomer!= null && i<arrAttachCustomer.length; i++) {
                    try {
                        record.attach({
                            record: {type: 'contact', id: contactId},
                            to: {type: 'customer', id: arrAttachCustomer[i]}
                        });
                    } catch (err) {
                        log.debug('Error in Catch : updateContact: ATTACH', 'ERR: ' + err.message);
                        isUpdated = 'fail';
                    }
                }
            }

            if(contactId && customersToDetatach && isCreate != "T") {
                var arrDetachCustomer = customersToDetatach.split(",");
			
                for(var i=0; arrDetachCustomer!= null && i<arrDetachCustomer.length; i++) {
                    try {
                        if(customerId != arrDetachCustomer[i]) {
                            record.detach({
                                record: {type: 'contact', id: contactId},
                                from: {type: 'customer', id: arrDetachCustomer[i]}
                            });
                        }
                    } catch (err) {
                        log.debug('Error in Catch : updateContact: DETACH', 'ERR: ' + err.message);
                        isUpdated = 'fail';
                    }
                }
            }

            var jsonObj = {};
            jsonObj["result"]  = [{'status': isUpdated}];
            context.response.write( JSON.stringify(jsonObj) );
        }

        function getContactList(context) {
            var customerId = context.request.parameters.customerid;
            var arrContacts = [];
            var contactList = {};
            if(customerId) {
                try {
                    var objCustomer = record.load({type: 'customer', id: customerId});
                    var lineCnt = objCustomer.getLineCount({ sublistId: 'contactroles' });
				
                    for(var i=0; i<lineCnt; i++) {
                        var contactName = objCustomer.getSublistValue({sublistId: 'contactroles', fieldId: 'contactname', line: i});
                        var contactEmail = objCustomer.getSublistValue({sublistId: 'contactroles', fieldId: 'email', line: i});
                        var internalId = objCustomer.getSublistValue({sublistId: 'contactroles', fieldId: 'contact', line: i});

                        var objContact = search.lookupFields({
                            type: search.Type.CONTACT,
                            id: internalId,
                            columns: ['custentity_wave_contact_primary']
                        });

                        var isPrimary = false;
                        if(objContact) {isPrimary = objContact.custentity_wave_contact_primary;}

                        arrContacts.push({contact_id: internalId, contact_name: contactName, contact_email: contactEmail, is_primary: isPrimary});
                    }
                    var jsonObj = {};
                    jsonObj["arrContacts"]  = arrContacts;
                    context.response.write( JSON.stringify(jsonObj) );
                } catch (err) {
                    log.debug('Error in Catch : getContactList', 'ERR: ' + err.message);
                }
            }
        }

        function getContactAssignments(context) {
            var customerId = context.request.parameters.customerid;
            var contactId = context.request.parameters.contactid;
            var arrCustomers = [];
            var arrAttachedCustomers = [];

            if(contactId) {
                // Get all attached customers
                var contactSearchObj = search.create({
                    type: "contact",
                    filters: [["customer.internalidnumber","greaterthan","0"], "AND", ["internalidnumber","equalto",contactId]],
                    columns: [search.createColumn({name: "internalid", join: "customer"})]
                });
                contactSearchObj.run().each(function(result){
                    arrAttachedCustomers.push( result.getValue({name: 'internalid', join: 'customer'}) );
                    return true;
                });
            }

            if(customerId) {
                var objLoginCustomer = record.load({type: record.Type.CUSTOMER, id: customerId});

                if(objLoginCustomer) {
                    var customer_altname = objLoginCustomer.getValue("custentity_wave_drybar_studio_name") || objLoginCustomer.getValue("altname");

                    // Pushed logged in customer
                    arrCustomers.push({
                        customer_id: customerId, 
                        customer_name: customer_altname, 
                        is_active: (arrAttachedCustomers && arrAttachedCustomers.indexOf( customerId ) != -1) ? true : false,
                        is_login: true
                    });

                    var contactAssignment = [];

                    var waveContactAssignment = objLoginCustomer.getValue("custentity_wave_contact_assignment");

                    for(var i=0; waveContactAssignment != null && i<waveContactAssignment.length; i++) {contactAssignment.push(waveContactAssignment[i]);}

                    //log.debug('contactAssignment', 'contactAssignment-FINAL: ' + JSON.stringify(contactAssignment));

                    if(contactAssignment.length > 0) {
                        var objCustomer = search.create({
                            type: search.Type.CUSTOMER,
                            columns: [{name: 'internalid'},{name: 'entityid'},{name: 'altname'},{name: 'custentity_wave_drybar_studio_name'}],
                            filters: [{name: 'internalid', operator: 'anyof', values: contactAssignment}]
                        });

                        objCustomer.run().each(function(result) {
                            var customer_altname = result.getValue({name: 'custentity_wave_drybar_studio_name'}) || result.getValue({name: 'altname'});

                            arrCustomers.push({
                                customer_id: result.getValue({name: 'internalid'}), 
                                customer_name: customer_altname, 
                                is_active: (arrAttachedCustomers && arrAttachedCustomers.indexOf( result.getValue({name: 'internalid'}) ) != -1) ? true : false,
                                is_login: false
                            });
                            return true;
                        });
                    }
                }
            }

            var jsonObj = {};
            jsonObj["arrCustomers"]  = arrCustomers;

            context.response.write( JSON.stringify(jsonObj) );
        }

        function getAllShippingAddress(context) {
            var customerId	= context.request.parameters.customerid;
            var contactId = context.request.parameters.contactid;
			var isRadiant = context.request.parameters.radiant;
            var arrAddress = [];
            var hotShippingItems = [];
            var isContactPrimary = false;
            var isOrderLimitSetter = false;
            var isOrderLimitApprover = false;
            var accessRole = "";
            var customerTerritory = "";
            var creditMemoBalance = 0;
			var allowCartAccess = "";

            if(customerId) {
                try {
                    var objCustomer = record.load({type: 'customer', id: customerId});
                    accessRole = objCustomer.getValue({fieldId:'accessrole'});
                    customerTerritory = objCustomer.getText({fieldId:'custentity_wave_customer_territory'});
                    creditMemoBalance = Number(objCustomer.getValue({fieldId:'custentity_wave_available_cm_balance'})) || 0;
					var hideCartAccess = objCustomer.getText({fieldId:'custentity_wave_rd_hide_cart_access'});
					if(hideCartAccess == "T") {
						allowCartAccess = "F";
					} else {
						allowCartAccess = "T";
					}
					
                    var lineCnt = objCustomer.getLineCount({ sublistId: 'addressbook' });
                    for(var i=0; i<lineCnt; i++) {
                        var addressId = objCustomer.getSublistValue({sublistId: 'addressbook', fieldId: 'addressid', line: i});

                        var addressSubrecord = objCustomer.getSublistSubrecord( {sublistId: 'addressbook', fieldId: 'addressbookaddress', line: i} );
                        var isShippingAddress = addressSubrecord.getValue( {fieldId: 'custrecord_is_shipping_address'} );
                        if(isShippingAddress) {arrAddress.push(addressId);}
                    }

                    if(contactId) {
                        var contactRolesCnt = objCustomer.getLineCount({ sublistId: 'contactroles' });
                        for(var i=0; i<contactRolesCnt; i++) {
                            var internalId = objCustomer.getSublistValue({sublistId: 'contactroles', fieldId: 'contact', line: i});
                            if(contactId == internalId){
                                accessRole = objCustomer.getSublistValue({sublistId: 'contactroles', fieldId: 'role', line: i});
                                break;
                            }
                        }
                    }
                } catch (err) {
                    log.debug('Error in Catch : getAllShippingAddress', 'ERR: ' + err.message);
                }
            }

            if(arrAddress) {arrAddress = arrAddress.join("||");}

            if(contactId) {
                var objContact = search.lookupFields({
                    type: search.Type.CONTACT,
                    id: contactId,
                    columns: ['custentity_wave_contact_primary', 'custentity_wave_order_limit_setter', 'custentity_wave_order_limit_approver']
                });

                isContactPrimary = objContact.custentity_wave_contact_primary;
                isOrderLimitSetter = objContact.custentity_wave_order_limit_setter;
                isOrderLimitApprover = objContact.custentity_wave_order_limit_approver;
            }

            // Get HoT Shipping Items
            var objHoTShippingItems = search.create({
                type: 'customrecord_wave_hot_ship_info_state',
                columns: [{name: 'internalid'},{name: 'custrecord_wave_hot_ship_web_name'},{name: 'custrecord_wave_hot_ship_state'},{name: 'shortname', join: 'CUSTRECORD_WAVE_HOT_SHIP_STATE'},{name: 'custrecord_wave_hot_ship_price'}],
                filters: [{name: 'isinactive', operator: 'is', values: 'F'}]
            }); // 

            objHoTShippingItems.run().each(function(result) {
                hotShippingItems.push({
                    internalid: result.getValue({name: 'internalid'}), 
                    ship_name: result.getValue({name: 'custrecord_wave_hot_ship_web_name'}), 
                    ship_state: result.getValue({name: 'shortname', join: 'CUSTRECORD_WAVE_HOT_SHIP_STATE'}),
                    ship_price: result.getValue({name: 'custrecord_wave_hot_ship_price'})
                }); 
                return true;
            });

            var jsonObj = {};
            jsonObj["arrAddress"]  = arrAddress;
            jsonObj["isContactPrimary"] = isContactPrimary;
            jsonObj["isOrderLimitSetter"] = isOrderLimitSetter;
            jsonObj["isOrderLimitApprover"] = isOrderLimitApprover;
            jsonObj["hotShippingItems"] = hotShippingItems;
            jsonObj["userRoleId"] = accessRole;
            jsonObj["customerTerritory"] = customerTerritory;
            jsonObj["creditMemoBalance"] = creditMemoBalance;
			if(isRadiant == "T") {
				jsonObj["allowCartAccess"] = allowCartAccess;
			}

            context.response.write( JSON.stringify(jsonObj) );
        }

        return {
            onRequest : onRequest
        };
    });
