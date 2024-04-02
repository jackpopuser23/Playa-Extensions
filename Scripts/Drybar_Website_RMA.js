/* eslint-disable no-mixed-spaces-and-tabs */
/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/email', 'N/runtime', 'N/record', 'N/search', 'N/render', 'N/log', 'N/https', 'N/url', 'N/file', 'N/xml', 'N/format'],
    function(ui, email, runtime, record, search, render, log, https, url, file, xml, format) {
        function onRequest(context) {
            var action	= context.request.parameters.action;

            if(action == "upload") {uploadItemData(context);}
            if(action == "getrmapdf") {getRMAPDF(context);}
        }

        function uploadItemData(context) {
            var returnId = context.request.parameters.returnid;
            var source = context.request.parameters.source;

            if(returnId != "") {
                try {
                    var objReturn = record.load({type: 'returnauthorization', id: returnId});
                    var customerId = objReturn.getValue("entity");
                    var lineCnt = objReturn.getLineCount({ sublistId: 'item' });
                    var arrItem = [];

                    for(var i=0; i<lineCnt; i++) {
                        arrItem.push({ internalid: objReturn.getSublistValue({sublistId: 'item', fieldId: 'item', line: i}), 
                            name: objReturn.getSublistText({sublistId: 'item', fieldId: 'item', line: i})});
                    }
                } catch (err) {
                    log.debug("ERR: ", JSON.stringify(err));
                }

                if (context.request.method === 'GET') {
                    var form = createRMAForm(customerId, returnId, arrItem, "", "", source);
				
                    context.response.writePage(form);
                } else {
                    // POST
                    var rmaFolderId = getFolderId();
                    var isSuccess = false; 
                    var isError = false; 
                    var formError = "";
                    var customerId = context.request.parameters.custpage_uid;
                    var returnId = context.request.parameters.returnid;
                    var source = context.request.parameters.source;
                    var itemsDesc = context.request.parameters.custpage_description;
                    var formData = ""; var strName = ""; var message = "";
                    var validateRes = [];

                    var imgTitle1 = context.request.parameters.custpage_img_title_1;
                    var imgFile1 = context.request.files.custpage_img_file_1;
                    var imgTitle2 = context.request.parameters.custpage_img_title_2;
                    var imgFile2 = context.request.files.custpage_img_file_2;
                    var imgTitle3 = context.request.parameters.custpage_img_title_3;
                    var imgFile3 = context.request.files.custpage_img_file_3;
                    var imgTitle4 = context.request.parameters.custpage_img_title_4;
                    var imgFile4 = context.request.files.custpage_img_file_4;

                    formData = {itemsdesc: itemsDesc, imgtitle1: imgTitle1, imgtitle2: imgTitle2, imgtitle3: imgTitle3, imgtitle4: imgTitle4};

                    if(imgFile1) {
                        var res = validateFile(imgFile1); 
                        validateRes.push({res: res, img: 'custpage_img_file_1'});
                    }

                    if(imgFile2) {
                        var res = validateFile(imgFile2);
                        validateRes.push({res: res, img: 'custpage_img_file_2'});
                    }

                    if(imgFile3) {
                        var res = validateFile(imgFile3);
                        validateRes.push({res: res, img: 'custpage_img_file_3'});
                    }

                    if(imgFile4) {
                        var res = validateFile(imgFile4);
                        validateRes.push({res: res, img: 'custpage_img_file_4'});
                    }

                    if(validateRes.length > 0) {
                        for(var i=0; validateRes != null && i<validateRes.length; i++) {
                            if(validateRes[i].res.err) {
                                isError = true;
                                formError = validateRes[i].res;
                            }
                            break;
                        }
                    }

                    if(isError) {
                        var form = createRMAForm(customerId, returnId, arrItem, formError, formData, source);
                        context.response.writePage(form);
                    } else {
                        isSuccess = true;
                        strName += "<table cellpadding='5' cellspacing='1'>";
                        strName += "<tr><td align='center'></td></tr>";

                        strName += "<tr><td><ul>";
                        for(var i=0; arrItem != null && i<arrItem.length; i++) {
                            strName += "<li>"+arrItem[i].name+"</li>";
                        }
                        strName += "</ul></td></tr>";

                        if(imgTitle1 != "") {strName += "<tr><td><strong>"+imgTitle1+"</strong></td></tr>";}
                        strName += getItemImage(validateRes, 'custpage_img_file_1');

                        if(imgTitle2 != "") {strName += "<tr><td><strong>"+imgTitle2+"</strong></td></tr>";}
                        strName += getItemImage(validateRes, 'custpage_img_file_2');

                        if(imgTitle3 != "") {strName += "<tr><td><strong>"+imgTitle3+"</strong></td></tr>";}
                        strName += getItemImage(validateRes, 'custpage_img_file_3');

                        if(imgTitle4 != "") {strName += "<tr><td><strong>"+imgTitle4+"</strong></td></tr>";}
                        strName += getItemImage(validateRes, 'custpage_img_file_4');
						
                        strName += "<tr bgcolor='#cccccc'><td><strong>Description:</strong></td></tr>";
                        strName += "<tr><td>"+itemsDesc+"</td></tr>";
						
                        strName += "</table>";

                        var xml = "<?xml version=\"1.0\"?>\n<!DOCTYPE pdf PUBLIC \"-//big.faceless.org//report\" \"report-1.1.dtd\">\n";
                        xml += "<pdf>";
                        xml += "<head>";
                        xml += "<macrolist>";
                        xml += "<macro id=\"rmaFooter\">";
                        xml += "<p align=\"right\" style=\"color: #6f6f6f\"><i>Added on "+format.format({value:new Date(), type: format.Type.DATE})+"</i></p>";
                        xml += "</macro>";
                        xml += "</macrolist>";
                        xml += "</head>";

                        xml += "\n<body font-size=\"12\" footer=\"rmaFooter\">\n<h3>Return Information</h3>\n";
                        xml += "<p></p>";
                        xml += strName;
                        xml += "</body>\n</pdf>";

                        try {
                            var pdfFileTmp = render.xmlToPdf({ xmlString: xml });
                            pdfFileTmp.folder = rmaFolderId;
                            pdfFileTmp.name = getTmpPDFName( returnId, source );
                            var pdfFileTmpId = pdfFileTmp.save();
                            var pdfFileTmpObj = file.load(pdfFileTmpId);
                        } catch (err){
                            log.debug("ERR: SAVE TMP PDF", JSON.stringify(err));
                        }
                        try {
                            // Create new updated RMA pdf
                            var attachedFileArr = checkRMAPdfCreated( returnId, source );
                            var oldPdfURL = ""; 
                            if(attachedFileArr != null && attachedFileArr.length > 0) {
                                oldPdfURL = attachedFileArr[0].url;
                            }

                            var tmpPdfURL = pdfFileTmpObj.url;
                            var xmlFinal = '<?xml version="1.0"?><!DOCTYPE pdf PUBLIC "-//big.faceless.org//report" "report-1.1.dtd">';
                            xmlFinal += '<pdfset>';
                            if(oldPdfURL != ""){ 
                                xmlFinal += '<pdf src="' + oldPdfURL + '"></pdf>'; 
                            }
                            xmlFinal += '<pdf src="' + tmpPdfURL + '"></pdf>';                                
                            xmlFinal += '</pdfset>';
                            xmlFinal = xmlFinal.replace(/&(?!(#\\d+|\\w+);)/g, "&amp;$1");

                            var rmaPDFFileObj = render.xmlToPdf({ xmlString: xmlFinal });
                            rmaPDFFileObj.folder = rmaFolderId;
                            rmaPDFFileObj.name = getPDFName( returnId, source );
                            var rmaPDFFileId = rmaPDFFileObj.save();

                            // Delete tmp pdf file
                            if(pdfFileTmpId != "") {file.delete({id: pdfFileTmpId});}
                        } catch (err) {
                            log.debug("ERR: SAVE FINAL PDF", JSON.stringify(err));
                        }
						
                        try {
                            // Attached PDF to Return Authorization
                            record.attach({
                                record: {type: 'file', id: rmaPDFFileId},
                                to: {type: 'returnauthorization', id: returnId}
                            });

                            // Attached PDF to Customer
                            record.attach({
                                record: {type: 'file', id: rmaPDFFileId},
                                to: {type: 'customer', id: customerId}
                            });

                            record.submitFields({type: 'returnauthorization', id: returnId, values: {custbody_wave_rma_file_uploaded: true} });
                        } catch (err) {
                            log.debug("ERR: ATTACH PDF", JSON.stringify(err));
                        }

                        // Delete uploaded item images from file cabinet
                        for(var i=0; i<validateRes.length; i++) {
                            var fileId = validateRes[i].res.fileid;
                            if(fileId != "") {file.delete({id: fileId});}
                        }
						
                        if(source == "erp"){
                            message = "<div style='text-align:center; padding: 100px 0px 100px 0px;font-size:13px'>The return information file has been created successfully</div> <script>setTimeout(function(){self.close();if(window.opener && !window.opener.closed){window.opener.location.reload();};}, 3000);</script>";
                        } else {
                            message = "<div style='text-align:center; padding: 100px 0px 100px 0px;font-size:13px'>The return information file has been created successfully</div> <script>self.close();if(window.opener && !window.opener.closed){window.opener.location.reload();};</script>";
                        }
                    }

                    if(isSuccess) {
                        context.response.write(message);
                    }
                }
            }
        }

        function getItemImage(validateRes, imgField) {
            var strName = "";
            if(validateRes && validateRes!=null) {
                for(var i=0; i<validateRes.length; i++) {
                    var imgStr = validateRes[i].res.msg;
                    var imgFile = validateRes[i].img;
				
                    if(imgField == imgFile){
                        if(imgStr != "") {
                            strName = imgStr+"<tr><td align='center'>&nbsp;</td></tr>";
                            return strName;
                        }
                    }
                    if(imgField == imgFile){
                        if(imgStr != "") {
                            strName = imgStr+"<tr><td align='center'>&nbsp;</td></tr>";
                            return strName;
                        }
                    }
                    if(imgField == imgFile){
                        if(imgStr != "") {
                            strName = imgStr+"<tr><td align='center'>&nbsp;</td></tr>";
                            return strName;
                        }
                    }
                    if(imgField == imgFile){
                        if(imgStr != "") {
                            strName = imgStr+"<tr><td align='center'>&nbsp;</td></tr>";
                            return strName;
                        }
                    }
                }
            }	
        }

        function createRMAForm(customerId, returnId, arrItem, formError, formData, source) {
            var form = ui.createForm({title: 'Customer Return Form', hideNavBar: true});

            var itemgroup = form.addFieldGroup({
                id : 'itemgroup',
                label : 'Return Item(s)'
            });

            var uploadgroup = form.addFieldGroup({
                id : 'uploadgroup',
                label : 'Upload Item Image(s)'
            });

            var actionField = form.addField({id: 'action', type: ui.FieldType.TEXT, label: 'Action'});
            actionField.updateDisplayType({displayType: ui.FieldDisplayType.HIDDEN});
            actionField.defaultValue = 'upload';

            var userField = form.addField({id: 'custpage_uid', type: ui.FieldType.TEXT, label: 'User'});
            userField.defaultValue = customerId;
            userField.updateDisplayType({displayType: ui.FieldDisplayType.HIDDEN});

            var returnField = form.addField({id: 'returnid', type: ui.FieldType.TEXT, label: 'Return'});
            returnField.updateDisplayType({displayType: ui.FieldDisplayType.HIDDEN});
            returnField.defaultValue = returnId;

            var sourceField = form.addField({id: 'source', type: ui.FieldType.TEXT, label: 'Source'});
            sourceField.updateDisplayType({displayType: ui.FieldDisplayType.HIDDEN});
            sourceField.defaultValue = source;

            if(formError != "" && formError.err) {
                var errInline = form.addField({id: 'custpage_err', type: ui.FieldType.INLINEHTML, label: 'Error: '});
                errInline.defaultValue = "<div style='color:#FF0000; font-weight:bold; padding: 0px;'><ul><li>"+formError.msg+"</li></ul></div>";
                errInline.updateLayoutType({ layoutType: ui.FieldLayoutType.STARTROW});
                errInline.updateLayoutType({ layoutType: ui.FieldLayoutType.OUTSIDEBELOW});
            }

            var returnItemList = "";
		
            for(var i=0; arrItem != null && i<arrItem.length; i++) {
                var num = Number(i+1);
                returnItemList += "<li class='labelSpanEdit smallgraytextnolink'>" + arrItem[i].name + "</li>";
            }

            var itemHeader = form.addField({
                id: 'custpage_itemheader',
                type: ui.FieldType.INLINEHTML,
                label: 'Item Header',
                container: 'itemgroup'
            });
            itemHeader.defaultValue = '<style>input { box-sizing: border-box; width:300px!important;} .uir-outside-fields-table{padding-top:5px!important;} #tbl_submitter{display:none;}</style> <ul style=\'font-size:13px\'>'+returnItemList+'</ul>';

            var uploadHeader = form.addField({
                id: 'custpage_uploadheader',
                type: ui.FieldType.INLINEHTML,
                label: ' ',
                container: 'uploadgroup'
            });
            uploadHeader.defaultValue = '';

            var imgTitle1 = form.addField({id: 'custpage_img_title_1', type: ui.FieldType.TEXT, label: 'Image Title'});
            imgTitle1.updateLayoutType({ layoutType: ui.FieldLayoutType.STARTROW});
            imgTitle1.updateLayoutType({ layoutType: ui.FieldLayoutType.OUTSIDEBELOW});
            imgTitle1.displaySize = {width: 60};
            if(formData.imgtitle1 != "") {imgTitle1.defaultValue = formData.imgtitle1;}

            var imgFileField1 = form.addField({id: 'custpage_img_file_1', type: 'file', label: 'Image 1'});
            imgFileField1.updateLayoutType({ layoutType: ui.FieldLayoutType.STARTROW});
            imgFileField1.updateLayoutType({ layoutType: ui.FieldLayoutType.OUTSIDEBELOW});

            var imgTitle2 = form.addField({id: 'custpage_img_title_2', type: ui.FieldType.TEXT, label: 'Image Title'});
            imgTitle2.updateLayoutType({ layoutType: ui.FieldLayoutType.STARTROW});
            imgTitle2.updateLayoutType({ layoutType: ui.FieldLayoutType.OUTSIDEBELOW});
            if(formData.imgtitle2 != "") {imgTitle2.defaultValue = formData.imgtitle2;}

            var imgFileField2 = form.addField({id: 'custpage_img_file_2', type: 'file', label: 'Image 2'});
            imgFileField2.updateLayoutType({ layoutType: ui.FieldLayoutType.STARTROW});
            imgFileField2.updateLayoutType({ layoutType: ui.FieldLayoutType.OUTSIDEBELOW});

            var imgTitle3 = form.addField({id: 'custpage_img_title_3', type: ui.FieldType.TEXT, label: 'Image Title'});
            imgTitle3.updateLayoutType({ layoutType: ui.FieldLayoutType.STARTROW});
            imgTitle3.updateLayoutType({ layoutType: ui.FieldLayoutType.OUTSIDEBELOW});
            if(formData.imgtitle3 != "") {imgTitle3.defaultValue = formData.imgtitle3;}

            var imgFileField3 = form.addField({id: 'custpage_img_file_3', type: 'file', label: 'Image 3'});
            imgFileField3.updateLayoutType({ layoutType: ui.FieldLayoutType.STARTROW});
            imgFileField3.updateLayoutType({ layoutType: ui.FieldLayoutType.OUTSIDEBELOW});

            var imgTitle4 = form.addField({id: 'custpage_img_title_4', type: ui.FieldType.TEXT, label: 'Image Title'});
            imgTitle4.updateLayoutType({ layoutType: ui.FieldLayoutType.STARTROW});
            imgTitle4.updateLayoutType({ layoutType: ui.FieldLayoutType.OUTSIDEBELOW});
            if(formData.imgtitle4 != "") {imgTitle4.defaultValue = formData.imgtitle4;}

            var imgFileField4 = form.addField({id: 'custpage_img_file_4', type: 'file', label: 'Image 4'});
            imgFileField4.updateLayoutType({ layoutType: ui.FieldLayoutType.STARTROW});
            imgFileField4.updateLayoutType({ layoutType: ui.FieldLayoutType.OUTSIDEBELOW});
		
            var description = form.addField({id: 'custpage_description', type: ui.FieldType.TEXTAREA, label: 'Description'});
            description.updateLayoutType({ layoutType: ui.FieldLayoutType.STARTROW});
            description.updateLayoutType({ layoutType: ui.FieldLayoutType.OUTSIDEBELOW});
            description.displaySize = {width: 60, height: 10};
            description.isMandatory = true;
            if(formData.itemsdesc != "") {description.defaultValue = formData.itemsdesc;}

            form.addSubmitButton({label: 'Submit'});

            return form;
        }

        function validateFile(itemFile) {
            var getFileType = itemFile.fileType.toUpperCase();
            var getFileSize = itemFile.size;
            var fileName	= itemFile.name;
            var objResponse = '';
		
            if(getFileSize < 5242880) // 1 MB
            {
                if(getFileType=='JPEGIMAGE' || getFileType=='JPGIMAGE' || getFileType=='PNGIMAGE' || getFileType=='GIFIMAGE') {
                    //Upload file in filecabinet
                    itemFile.name = fileName;
                    itemFile.folder = getFolderId();
                    var fileId = itemFile.save();
                    var fileObj = file.load({id: fileId});
                    var imgURL	  = fileObj.url;
                    imgURL = xml.escape({xmlText : imgURL});

                    objResponse = {err: false, errcode: '', fileid: fileId, msg:'<tr><td><img src="'+imgURL+'" width="500px" height="250px" /></td></tr>'};
                } else {
                    objResponse = {err: true, errcode: 'FILETYPE', msg:"Please select JPEG/JPG/PNG/GIF file only."};
                }
            } else {
                objResponse = {err: true, errcode: 'FILESIZE', msg:"The file size should be less than 1 MB."};
            }
            return objResponse;
        }

        function getRMAPDF(context) {
            var returnId = context.request.parameters.returnid;
            var arrAttachedFiles = [];
            var pdfFileName = getPDFName( returnId );
            var domain = context.request.parameters.domain || 'drybar.wave.store';

            if(returnId != "") {
                try {
                    var objSearch = search.create({
                        type: "returnauthorization",
                        filters: [["internalidnumber","equalto",returnId], "AND", ["mainline", "is", "T"], "AND", ["file.created","isnotempty",""], "AND", ["file.name","is",pdfFileName]],
                        columns: [search.createColumn({name: "internalid", join: "file", sort: "DESC"}), search.createColumn({name: "name", join: "file"}), search.createColumn({name: "url", join: "file"})]
                    });

                    objSearch.run().each(function(result){
                        //arrAttachedFiles.push( {id: result.getValue({name: 'internalid', join: 'file'}), name: result.getValue({name: 'name', join: 'file'}), url: 'https://drybar.wave.store'+result.getValue({name: 'url', join: 'file'})} );

                        arrAttachedFiles.push( {id: result.getValue({name: 'internalid', join: 'file'}), name: result.getValue({name: 'name', join: 'file'}), url: 'https://' + domain + result.getValue({name: 'url', join: 'file'})} );

                        return true;
                    });
                } catch (err) {
                    log.debug("ERR: ", JSON.stringify(err));
                }
            }

            var jsonObj = {};
            jsonObj["arrAttachedFiles"]  = arrAttachedFiles;

            context.response.write( JSON.stringify(jsonObj) );
        }

        function getPDFName(returnId, source) {		
            if(source == "erp"){
                return 'RETURN-AUTH-'+returnId+'-CS.pdf';
            } else {
                return 'RETURN-AUTH-'+returnId+'.pdf';
            }
        }

        function getTmpPDFName(returnId, source) {		
            if(source == "erp"){
                return 'RETURN-AUTH-'+returnId+'-CS-tmp.pdf';
            } else {
                return 'RETURN-AUTH-'+returnId+'-tmp.pdf';
            }
        }

        function getFolderId() {		
            return '1717643';
        }

        function checkRMAPdfCreated( returnId, source ) {
            try{
                var rmaPDFName = getPDFName( returnId, source );
                var resultArr = [];
                var transactionSearchObj = search.create({
                    type: "transaction",
                    filters:
					[
					    ["type","anyof","RtnAuth"],
					    "AND",
					    ["internalidnumber","equalto",returnId], 
					    "AND", 
					    ["mainline","is","T"],
					    "AND",
					    ["file.name","is",rmaPDFName]
					],
                    columns:
					[
					    search.createColumn({name: "tranid"}),
					    search.createColumn({name: "name", join: "file"}),
					    search.createColumn({name: "internalid", join: "file"}),
					    search.createColumn({name: "url", join: "file"})
					]
                });
                transactionSearchObj.run().each(function(result){
                    resultArr.push({name: result.getValue({name: 'name', join: 'file'}), url: result.getValue({name: 'url', join: 'file'})});
                    return true;
                });
		
                return resultArr;
            } catch(err) {
                log.debug("ERR: checkRMAPdfCreated", JSON.stringify(err));
            }
        }

        return {
            onRequest: onRequest
        };
    });