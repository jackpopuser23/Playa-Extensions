/**
 * @author Neeraj Shukla
 * @vendor TVG
 * 
 * @date 09/06/21
 * @description Triggered by TVG website customer login to get & update the contact details
 * @Version 1.x
 * @ScriptType Suitelet
 * @Path SuiteScripts/TVG_SL_Subcustomer_Toggle_1.0.js
 */

/**
 * This is a main function that calls the respective sub-function based on action parameter
 * 
 * @method getContactDetails
 * @param {String} request
 * @param {String} response
 * 
 * @returns {JSON Object} from sub-function
 */
function getContactDetails( request, response ) 
{
	var action = request.getParameter('action');

	if(action == "companylist") getCompanyList(request, response);

	if(action == "giveaccess") giveAccesPermission(request, response);

	if(action == "setcontactlogin") setContactLoginAccess(request, response);

	if(action == "sendcontactemail") sendContactLoginEmail(request, response);

	if(action == "duplicate") checkDuplicateEmail(request, response);
}


function checkDuplicateEmail(request, response)
{
	var contactId = request.getParameter('contactid');
	var email = request.getParameter('email');
	var requestType = request.getParameter('type'); //(contactId == "") ? "CREATE" : "UPDATE";

	var recordCount = 0;
	var recordType  = "contact";
	var isDuplicate = false;

	if(email && requestType == 'CREATE')
	{
		isDuplicate = true;
	}
	else if(contactId != "" && email && requestType == 'UPDATE')
	{
		var oldEmail = nlapiLookupField(recordType, contactId, "email");
		if(oldEmail != email) isDuplicate = true;
	}

	if(isDuplicate)
	{
		try
		{
			var objSearch = nlapiSearchRecord(recordType,null,
				[
				   ["email","is",email]
				], 
				[
				   new nlobjSearchColumn("email")
				]
			);
		}
		catch (err)
		{
			nlapiLogExecution('debug', 'CATCH OF checkDuplicateEmail(): ', JSON.stringify(err));
		}

		if(objSearch && objSearch.length>0) recordCount = objSearch.length;
	}
	
	response.write( JSON.stringify({"record_count": recordCount}) );
}


/**
 * This function Send brand specific contact email (Drybar - B2B, ALS - B2B & WAVE - B2B)
 * 
 * @method sendContactLoginEmail
 * @param {String} request
 * @param {String} response
 * 
 */
function sendContactLoginEmail(request, response)
{
	var customerId = request.getParameter('customerid');
	var contactList = request.getParameter('contactlist');
	var isAvailable = false;

	if(customerId && contactList)
	{
		var contactArr = (contactList.indexOf(",") == -1) ? [contactList] : contactList.split(",");

		var objCustomer = nlapiLoadRecord('customer', customerId);
		var customerSource = objCustomer.getFieldValue("custentity_wave_customer_source");

		for(var i=1; i<=objCustomer.getLineItemCount('contactroles'); i++)
		{
			var contactId = objCustomer.getLineItemValue('contactroles','contact',i);
			var contactName = objCustomer.getLineItemValue('contactroles','contactname',i);
			var contactEmail = objCustomer.getLineItemValue('contactroles','email',i);
			
			if( contactArr.indexOf( contactId ) != -1 ) 
			{
				var emailTemplate = getEmailTemplateId( customerSource );
				triggerContactEmail("create", customerId, contactName, contactEmail, "Welcome123", emailTemplate);

				objCustomer.setLineItemValue('contactroles', 'password', i, "Welcome123");
				objCustomer.setLineItemValue('contactroles', 'passwordconfirm', i, "Welcome123");
				isAvailable = true;
			}
		}

		if(isAvailable) {
			nlapiSubmitRecord(objCustomer, true, true);
		}
	}
}

function getEmailTemplateId( customerSource )
{
	var emailTemplateId = "";
	if( customerSource != "" )
	{
		switch (customerSource)
		{
			//Amazing Lash Studio (Franchisee)
			case "2":	
				emailTemplateId = "247";	
				break;
			//Drybar (Franchisee)
			case "7":	
				emailTemplateId = "233";	
				break;
			//Elements Massage (Franchisee)
			case "5":	
				emailTemplateId = "256";
				break;
			// Staff, Corporate, or All
			case "11":	
			case "12":
			case "13":
				emailTemplateId = "246";	
				break; 
			//Radiant Waxing B2B
			case "15":	
				emailTemplateId = "261";
				break;
			default:
				emailTemplateId = "247";
		}
	}
	
	return emailTemplateId;
}

function getDefaultCustomerCenterRole() 
{
	return "14";
}

function getCustomerCenterRole( lastCustomerId, contactId ) 
{
	var roleId = getDefaultCustomerCenterRole();
	if(lastCustomerId && contactId)
	{
		var lastCustomerRecord = nlapiLoadRecord("customer", lastCustomerId);
		for(var i=1; i<=lastCustomerRecord.getLineItemCount('contactroles'); i++)
		{
			var isAvailable = false;
			var listContactId = lastCustomerRecord.getLineItemValue('contactroles','contact',i);
			if(listContactId == contactId)
			{
				roleId = lastCustomerRecord.getLineItemValue('contactroles', 'role', i);
				break;
			}
		}
	}
	
	return roleId;
}

/**
 * This function is used to give the login access permission to contact against the selected customer
 * 
 * @method giveAccesPermission
 * @param {String} request
 * @param {String} response
 * 
 * @returns {JSON Object} {"SUCCESS": true OR false}
 */
function giveAccesPermission(request, response)
{
	var isSuccess = false;
	var hashTag = request.getParameter('hashTag');
	var custIdGiveAccess = request.getParameter('companyId');
	
	try
	{
		if(hashTag && custIdGiveAccess)
		{
			var arrHashTag = extractTokenData(hashTag);
			
			if(arrHashTag && arrHashTag.length == 4)
			{
				var email = arrHashTag[0];
				var contactPwd = arrHashTag[1].trim();
				var contactId = arrHashTag[2];
				var custIdRemoveAccess = arrHashTag[3];

				var custRecord = nlapiLoadRecord("customer", custIdGiveAccess);
				var custHasAccess = custRecord.getFieldValue('giveaccess');
				if(custHasAccess && custHasAccess == "T")
				{
					var roleId = getCustomerCenterRole( custIdRemoveAccess, contactId );
					
					for(var i=1; i<=custRecord.getLineItemCount('contactroles'); i++)
					{
						var isAvailable = false;
						var listContactId = custRecord.getLineItemValue('contactroles','contact',i);
						if(listContactId == contactId)
						{
							custRecord.selectLineItem('contactroles', i);
							custRecord.setCurrentLineItemValue('contactroles', 'giveaccess', 'T');				
							custRecord.setCurrentLineItemValue('contactroles', 'role', roleId);
							custRecord.setCurrentLineItemValue('contactroles', 'password', contactPwd);
							custRecord.setCurrentLineItemValue('contactroles', 'passwordconfirm', contactPwd);

							custRecord.commitLineItem('contactroles');

							isAvailable = true;
							break;
						}
					}

					if(isAvailable) 
					{
						var isRemoved = removeAccesPermission(contactId, custIdRemoveAccess);

						if(isRemoved)
						{
							var id = nlapiSubmitRecord(custRecord, true, true);
							nlapiSubmitField('contact', contactId, 'custentity_tvg_currently_accessing', custIdGiveAccess, true);

							//nlapiLogExecution("DEBUG", "Given Acces Permission: ", id);

							isSuccess = true;
						}
					}
					response.write( JSON.stringify({"SUCCESS": isSuccess}) );
				}
			}
		}
	}
	catch (err)
	{
		nlapiLogExecution("DEBUG", "ERROR: giveAccesPermission() ", JSON.stringify(err));
	}
}

/**
 * This function is used to remove the login access permission from the logged in customer record 
 * 
 * @method removeAccesPermission
 * @param {String} contactId - Logged in contact's internalid
 * @param {String} removeAccessId - Logged in customer's internalid
 * 
 * @returns none
 */
function removeAccesPermission(contactId, custIdRemoveAccess)
{
	try
	{
		if(custIdRemoveAccess && contactId)
		{
			var custRecord = nlapiLoadRecord("customer", custIdRemoveAccess);

			for(var i=1; i<=custRecord.getLineItemCount('contactroles'); i++)
			{
				var isAvailable = false;
				var listContactId = custRecord.getLineItemValue('contactroles','contact',i);
				if(listContactId == contactId)
				{
					custRecord.selectLineItem('contactroles', i);
					custRecord.setCurrentLineItemValue('contactroles', 'giveaccess', 'F');				
					custRecord.commitLineItem('contactroles');

					isAvailable = true;
					break;
				}
			}

			if(isAvailable) 
			{
				var id = nlapiSubmitRecord(custRecord, true, true);
				//nlapiLogExecution("DEBUG", "Removed Acces Permission: ", id);

				return true;
			}
			else
			{
				return false;
			}
		}
	}
	catch (err)
	{
		nlapiLogExecution("DEBUG", "ERROR: removeAccesPermission() ", JSON.stringify(err));
	}
}

/**
 * This function return the list of customer's records that attached with the logged in contact
 * 
 * @method getCompanyList
 * @param {String} request
 * @param {String} response
 * 
 * @returns {JSON Object} Parent Customers
 */
function getCompanyList(request, response)
{
	var contactId = request.getParameter('contactid'); 
	var customers = [];
	//var customerRole = getDefaultCustomerCenterRole();
	
	if(contactId)
	{
		var customerSearch = nlapiSearchRecord("customer",null,
								[ 
									["contact.internalid","is",contactId], "AND", 
									["contact.isinactive","is","F"], "AND", 
									["isinactive","is","F"], "AND", 
									//["role","anyof",customerRole], "AND", 
									["giveaccess","is","T"] 
								], 
								[ 
									new nlobjSearchColumn("internalid"), 
									new nlobjSearchColumn("altname"), 
									new nlobjSearchColumn("assignedsite"), 
									new nlobjSearchColumn("custentity_wave_drybar_studio_name").setSort(false) 
								]);

		if(customerSearch)
		{
			for(var i=0; i<customerSearch.length; i++)
			{
				if( customerSearch[i].getValue('assignedsite') == "" || customerSearch[i].getValue('assignedsite') == "4" )
				{
					var studioName = customerSearch[i].getValue('custentity_wave_drybar_studio_name') ? customerSearch[i].getValue('custentity_wave_drybar_studio_name') : customerSearch[i].getValue('altname');
					customers.push({'internalid': customerSearch[i].getValue('internalid'), 'name': studioName});
				}
			}
		}
	}
	
	var jsonObj = {};
	jsonObj["contactList"]  = customers;
	response.write( JSON.stringify(jsonObj) );
}


/**
 * @method extractTokenKey
 *
 * @returns {String} String
 */
function extractTokenKey()
{
	return "3373367638792F423F4528482B4D6251655468576D5A7134743777217A244326";
}

/**
 * This string is used to split the token hash value
 * 
 * @method extractSeprator
 *
 * @returns {String} String seprator
 */
function extractSeprator()
{
	return "||~#,||";
}


/**
 * This function is used to decrypt the hash string and split into array.
 * This array is a combination of contact's email, password, contactid & parent customerid
 *
 * @method extractTokenData
 * @param {String} hashTag
 * @param {String} secretTokenKey
 *
 * @returns {Array} Hash Tag Array
 */
function extractTokenData(hashTag)
{
	var strHashTag = nlapiDecrypt(hashTag, "aes", extractTokenKey() );
	var seprator = extractSeprator();
	var arrHashTag = ( strHashTag.indexOf(seprator) != -1 ) ? strHashTag.split(seprator):[];

	if(arrHashTag && arrHashTag.length == 4) return arrHashTag;
	else [];
}

/**
 * This function sets the login access to contact for selected customers/studios
 * 
 * @method getCompanyList
 * @param {String} request
 * @param {String} response
 * 
 * @returns {JSON Object} 
 */
function setContactLoginAccess(request,response) 
{
	var contactId = request.getParameter("contactid");
	var customerId = request.getParameter("customerid");
	var customerList = request.getParameter("customerlist");
	var secretKey = request.getParameter("secretkey");
	var type = request.getParameter("type"); //"create|update"
	var firstName = request.getParameter("firstname"); 
	var email = request.getParameter("email");
	var isSuccess = false;
	
	if(contactId && customerId && customerList)
	{
		try
		{
			// Set login access to contact
			var isAvailable = false;
			var objCustomer = nlapiLoadRecord('customer', customerId);
			var customerSource = objCustomer.getFieldValue("custentity_wave_customer_source");

			if(type == "create")
			{
				var roleId = objCustomer.getFieldValue('accessrole');
				for(var i=1; i<=objCustomer.getLineItemCount('contactroles'); i++)
				{
					if(objCustomer.getLineItemValue('contactroles','contact',i) == contactId)
					{
						var setPassword = nlapiDecrypt(secretKey, "aes");

						objCustomer.setLineItemValue('contactroles', 'giveaccess', i, 'T');
						objCustomer.setLineItemValue('contactroles', 'password', i, setPassword);
						objCustomer.setLineItemValue('contactroles', 'passwordconfirm', i, setPassword);
						objCustomer.setLineItemValue('contactroles', 'role', i, roleId);
						isAvailable = true;
						break;
					}
				}

				if(isAvailable) {
					nlapiSubmitRecord(objCustomer, true, true);
					var setPassword = nlapiDecrypt(secretKey, "aes");
					var emailTemplate = getEmailTemplateId( customerSource );
					triggerContactEmail(type, customerList, firstName, email, setPassword, emailTemplate);
					isSuccess = true;
				}
			}
			else // Update contact
			{
				/*
				// Commented the email functionality while updating the Contact through website
				var emailTemplate = getEmailTemplateId( customerSource ); // 234
				triggerContactEmail(type, customerList, firstName, email, "", emailTemplate);
				*/
				isSuccess = true;
			}
		}
		catch(err){ 
			nlapiLogExecution('debug','ERROR: setLoginAccess ',JSON.stringify(err)); 
		}
	}

	response.write(JSON.stringify({'SUCCESS': isSuccess}));
}

/**
 * This function send a login access email to contact
 * 
 * @method triggerContactEmail
 * @param {String} type
 * @param {String} customerList
 * @param {String} firstName
 * @param {String} email
 * @param {String} setPassword
 * @param {String} emailTemplate

 * 
 * @returns none
 */
function triggerContactEmail(type, customerList, firstName, email, setPassword, emailTemplate)
{
	if(type && customerList && email && firstName && emailTemplate)
	{
		var customersArr = (customerList.indexOf(",") == -1) ? [customerList] : customerList.split(",");
		var customerStr = "";

		try
		{
			var customerSearch = nlapiSearchRecord("customer",null, [["internalid","anyof",customersArr]], 
							[
								new nlobjSearchColumn("entityid"), 
								new nlobjSearchColumn("custentity_wave_drybar_studio_name").setSort(false), 
								new nlobjSearchColumn("altname")
							]);
			for(var i=0; customerSearch!=null && i<customerSearch.length; i++)
			{
				var studioName = customerSearch[i].getValue('custentity_wave_drybar_studio_name') ? customerSearch[i].getValue('custentity_wave_drybar_studio_name') : customerSearch[i].getValue('altname');

				customerStr += "#"+Number(i+1) +" "+ studioName+" <br>";
			}
		}
		catch (err)
		{
			nlapiLogExecution('debug','ERROR: triggerContactEmail: customerSearch ',JSON.stringify(err));
		}
		

		if(type == "create" && setPassword)
		{
			var template = nlapiLoadRecord('emailtemplate', emailTemplate);
			var content	= template.getFieldValue('content');
			var subject	= template.getFieldValue('subject');
			
			content = content.replace("#@#CONTACT_EMAIL#@#",email);
			content = content.replace("#@#CONTACT_PASSWORD#@#", setPassword);
		}
		else
		{
			var template = nlapiLoadRecord('emailtemplate', emailTemplate);
			var content	= template.getFieldValue('content');
			var subject	= template.getFieldValue('subject');
		}
		
		content = content.replace("#@#CONTACT_NAME#@#", firstName);
		content = content.replace("#@#CUSTOMERS_LIST#@#", customerStr);

		try
		{
			//nlapiLogExecution("DEBUG", "type: "+type, "customerList: "+customerList+" || firstName: "+firstName+" || email: "+email +" || setPassword: "+setPassword+" || emailTemplate: "+emailTemplate+" || subject: "+subject );

			nlapiSendEmail(1650, email, subject, content);
		}
		catch (err)
		{
			nlapiLogExecution('debug','ERROR: triggerContactEmail: nlapiSendEmail ',JSON.stringify(err));
		}
	}
}