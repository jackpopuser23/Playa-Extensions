/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
 
/* ************************************************************************
 * Company:     The Vested Group, www.thevested.com
 * Applies To:  SCA Extension - Case Management  
 ***********************************************************************/

define(['N/record', 'N/runtime', 'N/search', 'N/render', 'N/log', 'N/format'],
    function(record, runtime, search, render, log, format) {
        function onRequest(context) {
            var action = context.request.parameters.action;
            if(action == "caseform"){ getCaseFormConfig(context); }
            if(action == "salesorder"){ getSalesOrder(context); }
            if(action == "returnorder"){ getReturnTran(context); }
            if(action == "casedetails"){ getCaseDetails(context); }
            if(action == "createcase"){ createCaseRecord(context); }
            if(action == "caselist"){ getCaseList(context); }
        }


        function getCaseList(context) {
            var caseIds = context.request.parameters.caseids;
            var arrCaseList = [];

            if(caseIds!="") {
                caseIds = caseIds.substring(0, caseIds.length-1);
                var arrCaseIds = caseIds.split(",");
                try{
                    var filters = [
                        ["internalid","anyof",arrCaseIds], "AND", ["custevent_wave_sales_order_num.mainline", "is", "T"]
                    ];

                    var oSearch = search.create({
                        type: 'supportcase',
                        columns: [{name: 'internalid'},{name: 'tranid', join: 'custevent_wave_sales_order_num'}],
                        filters: filters
                    });

                    var oResults = executeSearch(oSearch);
                    for(var i=0; oResults!=null && i<oResults.length; i++) {
                        var result = oResults[i];                     
                        arrCaseList.push({
                            caseid: result.getValue({name: 'internalid'}), 
                            soid: result.getValue({name: 'tranid', join: 'custevent_wave_sales_order_num'})
                        });
                    }
                } catch(err){
                    log.error("ERROR IN getCaseList() CATCH: ", JSON.stringify(err));
                }
            }

            context.response.write( JSON.stringify(arrCaseList) );
        }


        function getCaseDetails(context) {
            var caseDetails = {};
            var caseId = context.request.parameters.caseid;
            if(caseId){
                try{
                    var oSearch = search.create({
                        type: 'supportcase', 
                        columns: [
                            {name: 'custevent_wave_sales_order_num'},
                            {name: 'tranid', join: 'custevent_wave_sales_order_num'},
                            {name: 'custevent_wave_case_return_number'},
                            {name: 'tranid', join: 'custevent_wave_case_return_number'},
                            {name: 'custevent_wave_item_case'}
                        ], 
                        filters: ["internalid", "is", caseId]
                    });
                    var oResults = executeSearch(oSearch);
                    if(oResults && oResults[0] != null) {
                        var result = oResults[0];
                        caseDetails.salesorderid = result.getValue({name: 'custevent_wave_sales_order_num'});
                        caseDetails.salesordertxt = result.getValue({name: 'tranid', join: 'custevent_wave_sales_order_num'});
                        caseDetails.returnorderid = result.getValue({name: 'custevent_wave_case_return_number'});
                        caseDetails.returnordertxt = result.getValue({name: 'tranid', join: 'custevent_wave_case_return_number'});
                        caseDetails.productname = result.getValue({name: 'custevent_wave_item_case'});
                    }
                } catch(err){
                    log.error("ERROR IN getCaseDetails() CATCH: ", JSON.stringify(err));
                }
            }
            //log.debug("caseObj: "+caseId, JSON.stringify({'casedetails': caseDetails}));
            context.response.write( JSON.stringify({'casedetails': caseDetails}));
        }


        function getReturnTran(context) {
            var customerId = context.request.parameters.customerid;
            var dateRange = context.request.parameters.daterange || '90';
            var arrReturn = [];
            var fromDate = "";
            var toDate = "";

            if(customerId) {
                try{
                    var filters = [
                        ["entity","is",customerId], "AND", ["mainline", "is", "T"], "AND", ["createdfrom.type","anyof","SalesOrd"]
                        //["mainline", "is", "T"], "AND", ["createdfrom.type","anyof","SalesOrd"]
                    ];

                    if(dateRange){
                        switch(dateRange){
                            case '90': toDate = format.format({value: new Date(), type: format.Type.DATE}); break;
                            case '180': toDate = getUpdatedDate(new Date(), '-91'); break;
                            case '270': toDate = getUpdatedDate(new Date(), '-181'); break;
                            case '360': toDate = getUpdatedDate(new Date(), '-271'); break;
                            default: toDate = format.format({value: new Date(), type: format.Type.DATE}); break;
                        }

                        fromDate = getUpdatedDate(new Date(), Number(-dateRange));
                        if(fromDate != "" && toDate != ""){
                            filters.push("AND");
                            filters.push(["trandate","within",fromDate,toDate]);
                        }
                    }
                    log.debug("RETURN - filters: "+dateRange, JSON.stringify(filters));

                    var oSearch = search.create({
                        type: 'returnauthorization',
                        columns: [{name: 'internalid'},{name: 'tranid', sort: 'DESC'},{name: 'trandate'},{name: 'createdfrom'},{name: 'tranid', join: 'createdfrom'}],
                        filters: filters
                    });

                    var oResults = executeSearch(oSearch);
                    for(var i=0; oResults!=null && i<oResults.length; i++) {
                        var result = oResults[i];
                        var soTranid = result.getValue({name:'tranid', join: 'createdfrom'});
                        
                        arrReturn.push({
                            id: result.getValue({name: 'internalid'}), 
                            tranid: result.getValue({name: 'tranid'}),
                            trandate: result.getValue({name: 'trandate'}),
                            soid: result.getValue({name: 'createdfrom'}),
                            sotranid: soTranid
                        });
                    }
                } catch(err){
                    log.error("ERROR IN getReturnTran() CATCH: ", JSON.stringify(err));
                }
            }

            var objReturn = {'returnorder': arrReturn};
            context.response.write( JSON.stringify(objReturn) );
        }


        function getUpdatedDate(dateVal, noOfDays){
            var newDate = "";
            if(noOfDays){
                try{
                    dateVal.setDate(noOfDays);
                    newDate = format.format({value: dateVal, type: format.Type.DATE});
                }catch(err){
                    log.debug("CATCH IN getUpdatedDate() :", JSON.stringify(err));
                    newDate = "";
                }
            }

            return newDate;
        }


        function getSalesOrder(context) {
            var customerId = context.request.parameters.customerid;
            var dateRange = context.request.parameters.daterange || '90';
            var arrSalesOrder = [];
            var fromDate = "";
            var toDate = "";

            if(customerId) {
                try{
                    var filters = [
                        ["entity","is",customerId], "AND", ["mainline", "is", "T"]
                    ];

                    if(dateRange){
                        switch(dateRange){
                            case '90': toDate = format.format({value: new Date(), type: format.Type.DATE}); break;
                            case '180': toDate = getUpdatedDate(new Date(), '-91'); break;
                            case '270': toDate = getUpdatedDate(new Date(), '-181'); break;
                            case '360': toDate = getUpdatedDate(new Date(), '-271'); break;
                            default: toDate = format.format({value: new Date(), type: format.Type.DATE}); break;
                        }

                        fromDate = getUpdatedDate(new Date(), Number(-dateRange));
                        if(fromDate != "" && toDate != ""){
                            filters.push("AND");
                            filters.push(["trandate","within",fromDate,toDate]);
                        }
                    }
                    log.debug("filters: "+dateRange, JSON.stringify(filters));
                    
                    var oSearch = search.create({
                        type: 'salesorder',
                        columns: [{name: 'internalid'},{name: 'tranid', sort: 'DESC'},{name: 'trandate'}],
                        filters: filters
                    });

                    var oResults = executeSearch(oSearch);
                    for(var i=0; oResults!=null && i<oResults.length; i++) {
                        var result = oResults[i];
                        
                        arrSalesOrder.push({
                            id: result.getValue({name: 'internalid'}), 
                            tranid: result.getValue({name: 'tranid'}),
                            trandate: result.getValue({name: 'trandate'})
                        });
                    }
                } catch(err){
                    log.error("ERROR IN getSalesOrder() CATCH: ", JSON.stringify(err));
                }
            }

            var objSales = {'salesorder': arrSalesOrder};
            context.response.write(JSON.stringify(objSales));
        }


        function getCaseFormConfig(context) {
            var customerId = context.request.parameters.customerid; //'1258216';
            var arrCaseForm = [];
            var arrCategory = [];
            var arrTmpCategory = [];
            var arrSubCategory = [];
            var locations = getLocations(context);
            var subDomainId = context.request.parameters.domainid;

            try{
                /*var oRec = record.create({type: 'customrecord_case_management_form', isDynamic: true});
                var fldCategory = oRec.getField({fieldId: 'custrecord_cm_case_inquiry_type'});
                var categoryOptions = fldCategory.getSelectOptions();
                (var i=0; categoryOptions!=null && i<categoryOptions.length; i++){
                    arrCategory.push({catid: categoryOptions[i].value, name: categoryOptions[i].text});
                }*/
                
                var filters = [
                    ["isinactive","is","F"], "AND",
                    ["custrecord_cm_applied_to_domain", "anyof", subDomainId]
                ];
                var columns = [
                    {name: 'internalid'},
                    {name: 'custrecord_cm_case_inquiry_type'},
                    {name: 'custrecord_cm_case_inquiry_subtype'},
                    {name: 'name'},
                    {name: 'custrecord_cm_is_sales_order'},
                    {name: 'custrecord_cm_is_return'},
                    {name: 'custrecord_cm_is_product'},
                    {name: 'custrecord_cm_is_help'},
                    {name: 'custrecord_cm_help_content'},
                    {name: 'custrecord_cm_is_description'},
                    {name: 'custrecord_cm_description_label'},
                    {name: 'custrecord_cm_applied_to_domain'},
                    {name: 'custrecord_cm_case_subtype_order'}
                ];
                var oSearch = search.create({type: 'customrecord_case_management_form', filters: filters, columns: columns});
                var oResults = executeSearch(oSearch);
                if(oResults && oResults.length){
                    for(var i=0; i<oResults.length; i++){
                        //log.debug("DEBUG", "RES: "+JSON.stringify(oResults[i]));
                        var res = oResults[i];
                        arrTmpCategory.push({
                            catid: res.getValue({name: 'custrecord_cm_case_inquiry_type'}), 
                            name: res.getText({name: 'custrecord_cm_case_inquiry_type'})
                        });

                        arrSubCategory.push({
                            "subcatid": res.getValue({name: 'custrecord_cm_case_inquiry_subtype'}),
                            "parentid": res.getValue({name: 'custrecord_cm_case_inquiry_type'}),
                            "name": res.getText({name: 'custrecord_cm_case_inquiry_subtype'}),
                            "order": res.getValue({name: 'custrecord_cm_case_subtype_order'})
                        });

                        arrCaseForm.push({
                            "subcatid": res.getValue({name: 'custrecord_cm_case_inquiry_subtype'}),
                            //"subcatid": res.getValue({name: 'internalid'}), 
                            "subcatname": res.getValue({name: 'name'}), 
                            "is_sales_order": res.getValue({name: 'custrecord_cm_is_sales_order'}), 
                            "is_return": res.getValue({name: 'custrecord_cm_is_return'}), 
                            "is_product": res.getValue({name: 'custrecord_cm_is_product'}), 
                            "is_help": res.getValue({name: 'custrecord_cm_is_help'}), 
                            "help_content": res.getValue({name: 'custrecord_cm_help_content'}), 
                            "is_description": res.getValue({name: 'custrecord_cm_is_description'}), 
                            "desc_label": res.getValue({name: 'custrecord_cm_description_label'})
                        });
                    }
                }
            } catch (err) {
                log.error("ERROR IN CATCH: ", JSON.stringify(err));
            }
            //log.debug("arrSubCategory: ", JSON.stringify(arrSubCategory));
            arrCategory = getUniqueData(arrTmpCategory);

            var objConfig = {
                currentlocation: customerId,
                locations: locations,
                category: arrCategory,
                formconfig: arrCaseForm,
                subcategory: arrSubCategory
            };
            
            context.response.addHeader('Content-Type', 'application/json');
            context.response.write( JSON.stringify(objConfig) );
        }


        function getLocations(context) {
            var customerId = Number(context.request.parameters.customerid); //'1258216';
            var contactId = Number(context.request.parameters.contactid); //'2608225';
            var arrCustomers = [];
            
            if(contactId > 0) {
                try {
                    var oSearch = search.create({
                        type: search.Type.CUSTOMER,
                        columns: [{name: 'internalid'},{name: 'entityid'},{name: 'assignedsite'},{name: 'custentity_wave_drybar_studio_name', sort: 'ASC'}],
                        filters: [
                            ["contact.internalid","is",contactId], "AND", 
                            ["contact.isinactive","is","F"], "AND", 
                            ["isinactive","is","F"], "AND", 
                            ["giveaccess","is","T"] 
                        ]
                    });
    
                    var oResults = executeSearch(oSearch);
                    for(var i=0; oResults!=null && i<oResults.length; i++) {
                        var result = oResults[i];
                        var customerName = result.getValue({name: 'custentity_wave_drybar_studio_name'}) || result.getValue({name: 'entityid'});
    
                        arrCustomers.push({
                            id: result.getValue({name: 'internalid'}), 
                            name: customerName
                        });
                    }
                } catch(err){
                    log.error("ERROR IN CATCH: getLocations: contactId: ", JSON.stringify(err));
                }
            } else {
                try{
                    var objCustomer = search.lookupFields({
                        type: 'customer',
                        id: customerId,
                        columns: ['custentity_wave_drybar_studio_name', 'entityid']
                    });
                    var customerName = objCustomer.custentity_wave_drybar_studio_name || objCustomer.entityid;
                    arrCustomers.push({id: customerId, name: customerName});
                } catch(err){
                    log.error("ERROR IN CATCH: getLocations: customer: ", JSON.stringify(err));
                }
            }

            return arrCustomers;
        }

        function createCaseRecord(context) {
    
	        var caseId = context.request.parameters.caseid;
            var fromId = context.request.parameters.from;
            var locationId = context.request.parameters.locationid;
            var dataProperty = context.request;


			if( dataProperty.hasOwnProperty("body") ) {

	            var data = JSON.parse(context.request.body);

				try
				{
					var objRecord = record.create({ type: 'supportcase', isDynamic: true });
					if(data.subject) objRecord.setValue({ fieldId: 'title', value: data.subject });
					if(data.locations) objRecord.setValue({ fieldId: 'company', value: data.locations });
					if(data.contactloginid && data.contactloginid != 0) objRecord.setValue({ fieldId: 'contact', value: data.contactloginid });
					if(data.inquiry_type) objRecord.setValue({ fieldId: 'category', value: data.inquiry_type });
					if(data.inquiry_subtype) objRecord.setValue({ fieldId: 'custevent_wave_sub_category_case', value: data.inquiry_subtype });
					if(data.return_order_id) objRecord.setValue({ fieldId: 'custevent_wave_case_return_number', value: data.return_order_id });
					if(data.sales_order_id) objRecord.setValue({ fieldId: 'custevent_wave_sales_order_num', value: data.sales_order_id });
					if(data.products) objRecord.setValue({ fieldId: 'custevent_wave_item_case', value: data.products });
					if(data.message) objRecord.setValue({ fieldId: 'incomingmessage', value: data.message });
					if(data.status) objRecord.setValue({ fieldId: 'status', value: data.status });
					if(data.origin) objRecord.setValue({ fieldId: 'origin', value: data.origin });
					var recordId = objRecord.save();
					//var recordId = 77889;

					var objReturn = {"success":true, "internalId":recordId, "isSameStudio": data.is_same_studio};
					context.response.write(JSON.stringify(objReturn) );
				}
				catch (e)
				{
					var error = e.details || e.message || e.toString();
					context.response.write(JSON.stringify({"success": false, "error11111111": error }) );
				}
			}
        }

        function executeSearch(srch) {
            var results = [];
            var count = 0;
            var pageSize = 1000;
            var start = 0;
    
            // run saved search
            do {
                var subresults = srch.run().getRange({
                    start: start,
                    end: start + pageSize
                });
    
                results = results.concat(subresults);
                count = subresults.length;
                start += pageSize;
            } while (count == pageSize);
    
            return results;
        }


        function getUniqueData(arr){
            var uniqueObject = {};
            var finalArr = [];
            for (var i=0; i<arr.length; i++) {
                var catId = arr[i]['catid'];
                uniqueObject[catId] = arr[i];
            }

            for(var i=0; i<JSON.stringify(uniqueObject).length; i++) {
                if(uniqueObject[i] instanceof Object && !(uniqueObject[i] instanceof Array)) { 
                    finalArr.push(uniqueObject[i]); 
                }
            }

            return finalArr;
        }


        return {
            onRequest: onRequest
        };
    });
