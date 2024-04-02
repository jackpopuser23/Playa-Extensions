/* eslint-disable no-redeclare */
/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */

/* ************************************************************************
 * Company:     The Vested Group, www.thevested.com
 * Applies To:  Cash Sale
 *
 *
 * Suitelet script develop for "Drybar - B2B" website.
 * Purpose -
 * 1) Get all drybar customers
 * 2) Print/download cash sale(s) of selected customers  
 * 
 ***********************************************************************/

define(['N/record', 'N/runtime', 'N/search', 'N/render', 'N/email', 'N/log', 'N/compress', 'N/file'],
    function (record, runtime, search, render, email, log, compress, file) {
        function onRequest(context) {
            var action	= context.request.parameters.action;
            
            if(action == "getcustomer")	{getCustomers(context);}
            if(action == "download") {downloadCashSale(context);}
            if(action == "downloadall") {downloadAllCashSales(context);}
            if(action == "cashsalelist") {getCashSaleList(context);}
			if(action == "downloadcsv") {downloadTransactionCSV(context);}
        }

		function downloadTransactionCSV(context) {
            var customers = context.request.parameters.customerid;
            var from = context.request.parameters.from;
            var to = context.request.parameters.to;
            var type = context.request.parameters.type;
            var tranStatus = [];
            var tranType = [];
            
            if(type != "") {
                if(type == "all") { 
                    tranType = ["CashSale","CustCred","CustInvc"];
                    tranStatus = ["CashSale:C","CustInvc:B","CustCred:A","CustCred:B"];
                }
                if(type == "cashsale|invoice") { 
                    tranType = ["CashSale","CustInvc"];
                    tranStatus = ["CustCred:A","CustInvc:B"]; 
                }
                if(type == "creditmemo") { 
                    tranType = ["CustCred"];
                    tranStatus = ["CustCred:A","CustCred:B"]; 
                }
            }

            if(customers && customers != "" && tranType.length > 0) {
                try {
                    customers = ( customers.indexOf(",") == -1 ) ? [customers] : customers.split(",");
                    
                    var filters = [];
                    filters.push(["type", "anyof", tranType]);
                    filters.push("AND");
                    filters.push(["name", "anyof", customers]);
                    filters.push("AND");
                    filters.push(["mainline", "is", "F"]);
                    filters.push("AND");
                    filters.push(["number", "isnotempty", ""]);

                    if(from !="" && to != "") {
                        var arrFrom = from.split("-");
                        from = arrFrom[1]+"/"+arrFrom[2]+"/"+arrFrom[0];
                        var arrTo = to.split("-");
                        to = arrTo[1]+"/"+arrTo[2]+"/"+arrTo[0];
        
                        filters.push("AND");
                        filters.push(["trandate","within",from,to]);
                    }

                    if(tranStatus && tranStatus.length > 0){
                        filters.push("AND");
                        filters.push(["status", "anyof", tranStatus]);
                    }
                    var itemNameFormula = {name: "formulatext", formula: "CASE WHEN {item.type} = 'Inventory Item' THEN  ltrim(regexp_substr({item},'[^:]*$')) ELSE {item} END", label: "Item"};

                    var objSearch = search.create({type: 'transaction', filters: filters, columns: [{name: 'type'}, {name: 'trandate', sort: "ASC"}, {name: 'tranid', sort: "ASC"}, {name: "custentity_wave_drybar_studio_name", join: "customer"}, {name: "custentity_wave_new_studio_number", join: "customer"}, {name: 'item'}, {name: 'type', join: 'item'}, {name: 'displayname', join: 'item'}, {name: 'custitem_wave_category', join: 'item'}, {name: 'quantity'}, {name: 'rate'}, {name: 'amount'}, itemNameFormula, {name: "handlingcost"}, {name: "memomain"}]});

                    var objSearchResult = objSearch.run().getRange(0, 1000);
                    if(objSearchResult != null && objSearchResult != "" && objSearchResult != " "){
                        var scriptObj = runtime.getCurrentScript();
                        var completeResultSet = objSearchResult; //copy the result
                        var start = 1000;
                        var last = 2000;

                        //if there are more than 1000 records
                        while(objSearchResult.length == 1000) {
                            objSearchResult = objSearch.run().getRange(start, last);
                            completeResultSet = completeResultSet.concat(objSearchResult);
                            start = parseFloat(start)+1000;
                            last = parseFloat(last)+1000;
                            //log.debug('Remaining governance units: ' + scriptObj.getRemainingUsage());
                        }
                        objSearchResult = completeResultSet;

                        //Headers of CSV File separated by commas and ends with a new line (\r\n)
                        var csvFile = 'Type,Date,Document Number,Studio Name/Location,Studio Number,Item,Item Name,Category,Quantity,Unit Price,Amount\r\n';
                        var arrUniqueItems = [];
                        for(var i=0; i<objSearchResult.length; i++){
                            var result = objSearchResult[i];
                            var type = result.getValue({name: 'type'}) || "";
                            if(type == "CustInvc") { type = "Invoice"; }
                            var date = result.getValue({name: 'trandate'}) || "";
                            var docNumber = result.getValue({name: 'tranid'}) || "";
                            var studioName = result.getValue({name: 'custentity_wave_drybar_studio_name', join: 'customer'}) || "";
                            var studioNumber = result.getValue({name: 'custentity_wave_new_studio_number', join: 'customer'}) || "";
                            var itemType = result.getValue({name: 'type', join: 'item'}) || "";
                            var itemId = result.getValue({name: 'item'}) || "";
                            var uniqueLine = docNumber+"-"+itemId;
                            var item = "\""+result.getValue({name: "formulatext"})+"\"" || "";
                            var itemDisplayName = "\""+result.getValue({name: 'displayname', join: 'item'})+"\"" || "";
                            if(item != "" && itemType == "ShipItem"){
                                item = item.replace("®","");
                            }
                            if(itemDisplayName != "" && itemType == "ShipItem"){
                                itemDisplayName = itemDisplayName.replace("®","");
                            }

                            var itemCategory = "\""+result.getValue({name: 'custitem_wave_category', join: 'item'})+"\"" || "";
                            var quantity = result.getValue({name: 'quantity'}) || "";
                            var rate = result.getValue({name: 'rate'}) || "";
                            var amount = result.getValue({name: 'amount'}) || "";

                            if(arrUniqueItems.indexOf(uniqueLine) == -1){
                                csvFile += type+','+date+','+docNumber+','+studioName+','+studioNumber+','+item+','+itemDisplayName+','+itemCategory+','+quantity+','+rate+','+amount+'\r\n';
                                
                                arrUniqueItems.push(uniqueLine);
                            }
                        }

                        var fileObj = file.create({
                            name: 'Transaction-Download.csv',
                            fileType: file.Type.CSV,
                            contents: csvFile
                        });
                        fileObj.encoding = "UTF-8";

                        context.response.writeFile(fileObj);
                    } else {
                        context.response.write( JSON.stringify({status: "error", message: "No records found"}) );
                    }
                } catch (err) {
                    log.debug('Error in Catch : downloadTransactionCSV:', 'ERR: ' + err.message);
                    context.response.write( JSON.stringify({status: "error", message: "No records found"}) );
                }
            } else {
                context.response.write( JSON.stringify({status: "error", message: "No records found"}) );
            }
        }

        function getCustomers(context) {
            var contactId = context.request.parameters.contactid;
            var arrCustomers = [];
            var arrCustomersId = [];

            if(contactId) {
                try {
                    // Get all attached customers
                    var contactSearchObj = search.create({
                        type: "contact",
                        filters: [["customer.internalidnumber","greaterthan","0"], "AND", ["internalidnumber","equalto",contactId], "AND", ["isinactive","is","F"]],
                        columns: [search.createColumn({name: "internalid", join: "customer"})]
                    }); 
                    contactSearchObj.run().each(function(result){
                        arrCustomersId.push( result.getValue({name: 'internalid', join: 'customer'}) );
                        return true;
                    });

                    if(arrCustomersId && arrCustomersId.length > 0) {
                        var customerSearchObj = search.create({
                            type: "customer",
                            filters: [["internalid","anyof",arrCustomersId], "AND", ["isinactive","is","F"]],
                            columns: [{name: 'internalid'}, {name: 'parent', sort: search.Sort.ASC}, {name: 'companyname'}, {name: 'custentity_wave_drybar_studio_name'}, {name: 'companyname', join: 'parentcustomer'}]
                        });
                        customerSearchObj.run().each(function(result){
                            var parentCompanyName = result.getValue({name: 'companyname', join: 'parentcustomer'}) || result.getValue({name: 'companyname'});
                            arrCustomers.push({
                                internalid: result.getValue({name: 'internalid'}), 
                                parentid: result.getValue({name: 'parent'}), 
                                parentcompanyname: parentCompanyName, 
                                companyname: result.getValue({name: 'companyname'}), 
                                studioname: result.getValue({name: 'custentity_wave_drybar_studio_name'})
                            });
        
                            return true;
                        });
                    }

                    var parentArr = [];
                    for(var i=0; i<arrCustomers.length; i++) {
                        if(parentArr.indexOf(arrCustomers[i].parentid) == -1) {parentArr.push(arrCustomers[i].parentid);}
                    }

                    var customerArr = [];
                    for(var i=0; i<parentArr.length; i++) {
                        var parentId = parentArr[i];
                        var parentCompanyName = "";
                        var subcustomerArr = [];
                        for(var j=0; j<arrCustomers.length; j++)
                        {
                            if(parentId == arrCustomers[j].parentid) {
                                parentCompanyName = arrCustomers[j].parentcompanyname;
                                subcustomerArr.push(arrCustomers[j]);
                            }
                        }
                        customerArr.push({parentid: parentId, parentcompanyname: parentCompanyName, subcustomer: subcustomerArr}); 
                    }
                } catch (err) {
                    log.debug('Error in Catch : getCustomers', 'ERR: ' + err.message);
                }
            }

            var jsonObj = {};
            jsonObj["customers"]  = customerArr;
            context.response.write( JSON.stringify(jsonObj) );
        }

        function downloadCashSale(context) {
            var isDownloaded = "fail";
            var tranId = context.request.parameters.cashsaleid;
            var tranType = context.request.parameters.type;

            if(tranType != "" && tranId != "") {
                try {
                    var templateId = getTemplateId(tranType);
                    if(templateId) {    
                        var xmlStr = "<?xml version=\"1.0\"?>\n<!DOCTYPE pdf PUBLIC \"-//big.faceless.org//report\" \"report-1.1.dtd\">\n";
                        xmlStr += '<pdfset>';
                        var renderer = render.create();
                        renderer.setTemplateById(templateId); 
                        renderer.addRecord({ templateName: 'record', record: record.load({type: tranType, id: tranId}) });
                        xmlStr += renderer.renderAsString();
                        xmlStr += '</pdfset>';

                        isDownloaded = "success";
                        context.response.renderPdf(xmlStr);
                    }
                } catch (err) {
                    log.debug('Error in Catch : downloadCashSale:', 'ERR: ' + err.message);
                }
            }
           
            var jsonObj = {};
            jsonObj["status"]  = isDownloaded;
            context.response.write( JSON.stringify(jsonObj) );
        }
        
        // CHANGE TEMPLATE ID FOR PRODUCTION
        function getTemplateId(type) {
            var templateId = "";
            switch(type){
                case 'cashsale': templateId = "112"; break;
                case 'invoice': templateId = "114"; break;
                case 'creditmemo': templateId = "115"; break;
                case 'customerdeposit': templateId = "116"; break;
            }
            return templateId;
        }
        
        function downloadAllCashSales(context) {
            var tranIds = context.request.parameters.tranids;
            var tranType = context.request.parameters.type;
            var page = context.request.parameters.page || "1";
            var isDownloaded = "fail";
            var arrPrintTran = [];
            
            var arrTrans = [];
            if(tranIds) {
                arrTrans = ( tranIds.indexOf(",") == -1 ) ? [tranIds] : tranIds.split(",");
                for(var i=0; arrTrans!=null && i<arrTrans.length; i++) {
                    var arrTranDetails = arrTrans[i].split("||");
                    arrPrintTran.push({internalid: arrTranDetails[0], type: arrTranDetails[1], name: arrTranDetails[2]});
                }
            }

            //if(tranType == "cashsaleinvoice" && arrPrintTran.length > 0) {
            if(arrPrintTran.length > 0) {    
                try {
                    // create an archive as a temporary file object
                    var archiver = compress.createArchiver();
                    for(var i=0; arrPrintTran!=null && i<arrPrintTran.length; i++) {
                        var tranId = arrPrintTran[i].internalid;
                        try {
                            var templateId = getTemplateId(arrPrintTran[i].type);
                            if(templateId) {
                                var renderer = render.create();
                                renderer.setTemplateById(templateId);
                                renderer.addRecord({
                                    templateName: 'record',
                                    record: record.load({type: arrPrintTran[i].type, id: arrPrintTran[i].internalid}) // 20 units
                                });

                                var pdfFile = renderer.renderAsPdf(); // 10 units
                                pdfFile.name = arrPrintTran[i].name+'.pdf';
                                archiver.add({file: pdfFile});
                            }
                        } catch (err) {
                            log.debug('Error in Catch : downloadAllCashSales: tranId: '+arrPrintTran[i].internalid, 'ERR: ' + err.message);
                        }
                    }
                    var todayDate = new Date();
                    var dtString = Number(todayDate.getMonth()+1)+"."+todayDate.getDate()+"."+todayDate.getFullYear();
                    var zipFile = archiver.archive({name: dtString+'-'+tranType+'-download-'+ page +'.zip'}); // 25 units
                    isDownloaded = "success";
                    context.response.addHeader({name: 'Content-Type',value: 'application/zip'});
                    context.response.writeFile( {file: zipFile, isInline: false} );
                } catch (err) {
                    log.debug('Error in Catch : downloadAllCashSales:', 'ERR: ' + err.message);
                }
            }

            var jsonObj = {};
            jsonObj["status"]  = isDownloaded;
            //context.response.write( JSON.stringify(jsonObj) );
        }

        function getCashSaleList(context) {
            var arrCashSale = [];

            var reqBody = JSON.parse(context.request.body);
            var customers = reqBody.customers;
            var from = context.request.parameters.from;
            var to = context.request.parameters.to;
            var tranType = context.request.parameters.type;
			var status = context.request.parameters.status;
			var tranStatus = [];
            var arrTrans = [];
            
            if(tranType != "") {
                if(tranType == "all") { 
					tranType = "cashsale|invoice|creditmemo|customerdeposit";
					tranStatus = ["CashSale:C","CustInvc:B","CustCred:A","CustCred:B"];
                    if(status == 'T'){
                        tranType = "cashsale|invoice|creditmemo";
                    }
				}
				if(tranType == "cashsale|invoice") { 
                    tranStatus = ["CashSale:C","CustInvc:B"]; 
                }
                if(tranType == "creditmemo") { 
                    tranStatus = ["CustCred:A","CustCred:B"]; 
                }
              	if(tranType == "deposit") { tranType = "customerdeposit"; }
                arrTrans = ( tranType.indexOf("|") == -1 ) ? [tranType] : tranType.split("|");
            }

            if(customers && customers != "" && arrTrans.length > 0) {
                try {
                    customers = ( customers.indexOf(",") == -1 ) ? [customers] : customers.split(",");
                    
                    var filters = [];
                    filters.push(["customer.internalid", "anyof", customers]);
                    filters.push("AND");
                    filters.push(["mainline", "is", "T"]);
                    filters.push("AND");
                    filters.push(["number", "isnotempty", ""]);

					if(status == 'T' && tranStatus && tranStatus.length > 0) { 
                        filters.push("AND");
                        filters.push(["status", "anyof", tranStatus]);
                    }

                    if(from !="" && to != "") {
                        var arrFrom = from.split("-");
                        from = arrFrom[1]+"/"+arrFrom[2]+"/"+arrFrom[0];
                        var arrTo = to.split("-");
                        to = arrTo[1]+"/"+arrTo[2]+"/"+arrTo[0];
        
                        filters.push("AND");
                        filters.push(["trandate","within",from,to]);
                    }

                    for(var i=0; arrTrans != null && i<arrTrans.length; i++) {
                        var objSearch = search.create({type: arrTrans[i], filters: filters, columns: [{name: 'total'}, {name: 'number'}, {name: "custentity_wave_drybar_studio_name", join: "customer", sort: "ASC"},{name: 'datecreated'}]});

                        objSearch.run().each(function(result){
                            arrCashSale.push({internalid: result.id, totalamount: result.getValue({name: "total"}), name: result.getValue({name: "custentity_wave_drybar_studio_name", join: "customer"})+" - "+result.getValue({name: "number"}), type: arrTrans[i], datecreated: result.getValue({name: "datecreated"})});
                            return true;
                        });
                    }
                } catch (err) {
                    log.debug('Error in Catch : getCashSaleList:', 'ERR: ' + err.message);
                }
            }
            const sortedDesc = arrCashSale.sort(function(objA, objB){ return new Date(objB.datecreated) - new Date(objA.datecreated); });

            var jsonObj = {};
            jsonObj["cashsales"]  = sortedDesc; //arrCashSale;
            context.response.write( JSON.stringify(jsonObj) );
        }

        return {
            onRequest : onRequest
        };
    });
