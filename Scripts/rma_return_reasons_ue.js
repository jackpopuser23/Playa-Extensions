/* eslint-disable no-prototype-builtins */
"use strict";

/* ***********************************************************************
 *
 * This User event script includes below functionality
 *
 *  Applied in the Return Authorization record before submit record
 *  Update the following custom line item fields from website based on the Return Reasons description
 *		- custcol_wave_return_issue
 *		- custcol_wave_return_issue_other
 *
 * Version    Date              Author           Remarks
 * 1.00       29 March 2023     Neeraj			 Initial commit
 *
 ***********************************************************************/

/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
*/

// eslint-disable-next-line no-undef
define(['N/log','N/record','N/runtime','N/https','N/search'],
    function (log,record,runtime,https,search) {

        /**
         * Function definition to be triggered before record is loaded.
         * @param {Object} context
         * @param {Record} context.newRecord - New record
         * @param {string} context.type - Trigger type
         * @param {Form} context.form - Current form
         * @Since 2015.2
         */
        function beforeSubmit(context) {

            try {
				//if (context.type !== context.UserEventTypes.CREATE) return;
                var currentRecord = context.newRecord;

				if(runtime.executionContext=='WEBSTORE') {

					const nsDomainName = currentRecord.getText({fieldId: "custbody_source_domain"});

					//if(nsDomainName && nsDomainName.indexOf("shop")==-1) {

						var currentLineCount = currentRecord.getLineCount({ sublistId: 'item' });
						var returnReasons = getReturnOptions();

						if(!returnReasons) return;

						var objOtherReason = getOtherReason(returnReasons);

						for (var i = 0; i < currentLineCount; i++) {
							var currentReason   = currentRecord.getSublistValue({sublistId: 'item', fieldId: 'description', line: i});
							var currentQuantity = currentRecord.getSublistValue({sublistId: 'item', fieldId: 'quantity', line: i});

							if(currentReason && currentQuantity>0) {

								var currentItemType = currentRecord.getSublistValue({sublistId: 'item', fieldId: 'itemtype', line: i});
								var currentItemId   = currentRecord.getSublistValue({sublistId: 'item', fieldId: 'item', line: i});
									currentItemType = getItemRecordType(currentItemType);
								var currentItemName = search.lookupFields({type: currentItemType, id: currentItemId, columns: ["displayname", "salesdescription"]});
								var currentSaleDesc = "";

								if(currentItemName && currentItemName.salesdescription) currentSaleDesc = currentItemName.salesdescription;
								else if(currentItemName && currentItemName.displayname) currentSaleDesc = currentItemName.displayname;

								log.debug("currentItemName::::::", currentSaleDesc);

								var objFoundReason = compareReturnReason(currentReason, returnReasons);

								if (objFoundReason && objFoundReason.hasOwnProperty('text')) {
									currentRecord.setSublistValue({sublistId: 'item', fieldId: 'custcol_wave_return_issue', value: objFoundReason.id, line: i});
									currentRecord.setSublistValue({sublistId: 'item', fieldId: 'description', value: currentSaleDesc, line: i});

								} else if (objOtherReason && objOtherReason.hasOwnProperty('text')) {
									currentRecord.setSublistValue({sublistId: 'item', fieldId: 'custcol_wave_return_issue', value: objOtherReason.id, line: i});
									currentRecord.setSublistValue({sublistId: 'item', fieldId: 'custcol_wave_return_issue_other', value: currentReason, line: i});
									currentRecord.setSublistValue({sublistId: 'item', fieldId: 'description', value: currentSaleDesc, line: i});
								}
							}
						}
					//}
				}
            } catch (error) {
				log.debug("Error:", error );
            }
        }

		function getItemRecordType(recordType)
		{
			var recordType = recordType.toLowerCase().trim();

			switch (recordType)
			{
				case 'invtpart':
					return 'inventoryitem';
				case 'description':
					return 'descriptionitem';
				case 'assembly':
					return 'assemblyitem';
				case 'discount':
					return 'discountitem';
				case 'group':
					return 'itemgroup';
				case 'markup':
					return 'markupitem';
				case 'noninvtpart':
					return 'noninventoryitem';
				case 'othcharge':
					return 'otherchargeitem';
				case 'payment':
					return 'paymentitem';
				case 'service':
					return 'serviceitem';
				case 'subtotal':
					return 'subtotalitem';        
				default:
					return recordType;
			}
		}

		function getReturnOptions() {
			var arrReasonList = [];
            //var loadRecord = record.load({type: "customlist", id: "682"});
			var loadRecord = record.load({type: "customlist", id: "773"});
			var lineItemCount = loadRecord.getLineCount({ sublistId: 'customvalue' });

			for (var i = 0; i < lineItemCount; i++) {
				var reasonId = loadRecord.getSublistValue({sublistId: 'customvalue', fieldId: 'valueid', line: i});
				var reasonText = loadRecord.getSublistValue({sublistId: 'customvalue', fieldId: 'value', line: i});

				arrReasonList.push({"id": reasonId, "text": reasonText})
			}

			return arrReasonList;
		}

		function compareReturnReason(currentReason, returnReasons) {

			var objFoundReason = "";

			if(currentReason) currentReason = currentReason.trim();

			for (var i = 0; i < returnReasons.length; i++) {
				if( (currentReason).toLowerCase()==(returnReasons[i].text).toLowerCase() ) objFoundReason = returnReasons[i];
			}

			return objFoundReason;
		}

		function getOtherReason(returnReasons) {

			var objOtherReason = "";

			for (var i = 0; i < returnReasons.length; i++) {
				if((returnReasons[i].text).toLowerCase()=="other") objOtherReason = returnReasons[i];
			}

			return objOtherReason;
		}

        return {
            beforeSubmit: beforeSubmit
        };
    }
);