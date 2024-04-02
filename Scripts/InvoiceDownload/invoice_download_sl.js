/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/record', 'N/runtime', 'N/search', 'N/render', 'N/email', 'N/log', 'N/compress', 'N/file', 'N/format'],
    function(serverWidget, record, runtime, search, render, email, log, compress, file, format) {
        function onRequest(context) {
            var form = serverWidget.createForm({title: 'Invoice Download', hideNavBar: false});
            var fldFranchisee = form.addField({
                id: 'custpage_franchisee',
                type: serverWidget.FieldType.SELECT,
                label: 'Franchisee/Owner',
                source: 'customer'
            });
            fldFranchisee.isMandatory = true;

            var fldStudioLocation = form.addField({
                id: 'custpage_studio_location',
                type: serverWidget.FieldType.MULTISELECT,
                label: 'Studio Location(s)'
            });
            //fldStudioLocation.isMandatory = true;

            var fldTransType = form.addField({
                id: 'custpage_tran_type',
                type: serverWidget.FieldType.SELECT,
                label: 'Transaction Type'
            });
            fldTransType.addSelectOption({value: 'all', text: 'All Transactions'});
            fldTransType.addSelectOption({value: 'cashsale|invoice', text: 'Cash Sale/Invoice'});
            fldTransType.addSelectOption({value: 'creditmemo', text: 'Credit Memo'});
            fldTransType.addSelectOption({value: 'customerdeposit', text: 'Deposit'});
            fldTransType.updateBreakType({breakType: serverWidget.FieldBreakType.STARTCOL});

            var fldFrom = form.addField({id: 'custpage_from', type: serverWidget.FieldType.DATE, label: 'Date'});
            fldFrom.updateBreakType({breakType: serverWidget.FieldBreakType.STARTCOL});
            var firstDayOfPrevMonth = new Date();
            firstDayOfPrevMonth.setDate(1);
            firstDayOfPrevMonth.setMonth(firstDayOfPrevMonth.getMonth()-1);
            fldFrom.defaultValue = format.format({value: firstDayOfPrevMonth, type: format.Type.DATE});
      
            var fldTo = form.addField({id: 'custpage_to', type: serverWidget.FieldType.DATE, label: 'Date'});
            var lastDayOfPrevMonth = new Date();
            lastDayOfPrevMonth.setMonth(lastDayOfPrevMonth.getMonth(), 0);
            fldTo.defaultValue = format.format({value: lastDayOfPrevMonth, type: format.Type.DATE});

            form.addSubmitButton({label: 'Submit'});
            //form.addResetButton({label: 'Reset'});

            form.clientScriptModulePath = './invoice_download_cs.js';
      

            if (context.request.method === 'GET') {
                context.response.writePage(form);
            } else if (context.request.method === 'POST') {
                var tab = form.addTab({id : 'transaction_tab', label : 'Transaction List 1234567890'});
                var fldTransList = form.addField({id: 'custpage_trans_list', type: serverWidget.FieldType.INLINEHTML, label: 'List', container: "transaction_tab"});
                fldTransList.updateBreakType({breakType: serverWidget.FieldBreakType.STARTCOL});
                fldTransList.updateDisplaySize({height: 400, width: 600});

                var franchisee = context.request.parameters.custpage_franchisee;
                var studioLocation = context.request.parameters.custpage_studio_location;
                var delimiter = /\u0005/;
                var selectedStudioLocations = studioLocation.split(delimiter);
                if(selectedStudioLocations == "") { selectedStudioLocations = franchisee; }
                var tranType = context.request.parameters.custpage_tran_type;
                var from = context.request.parameters.custpage_from;
                var to = context.request.parameters.custpage_to;
          
                // Set value in form fields
                if(franchisee && fldFranchisee && fldStudioLocation) {
                    fldFranchisee.defaultValue = franchisee;
                    var studioSearch = search.create({
                        type: 'customer',
                        filters: [['parent','is',franchisee], "AND", ['isinactive','is','F']],
                        columns: ['entityid','companyname','parent','custentity_wave_drybar_studio_name']
                    });
                    var studioSearchResults = studioSearch.run().getRange({ start: 0, end: 1000 });
  
                    if(studioSearchResults.length != 0) {
                        for(var i in studioSearchResults) {
                            if(studioSearchResults[i].getValue('parent')){
                                var isSelected = (selectedStudioLocations.indexOf(studioSearchResults[i].id) == -1) ? false : true
                                log.debug("DEBUG: isSelected .indexOf: "+studioSearchResults[i], "isSelected: "+isSelected+" || selectedStudioLocations: "+JSON.stringify(selectedStudioLocations));
                                if(franchisee != studioSearchResults[i].id) {
                                    fldStudioLocation.addSelectOption({value: studioSearchResults[i].id, text: studioSearchResults[i].getValue('custentity_wave_drybar_studio_name') || studioSearchResults[i].getValue('entityid'), isSelected: isSelected});
                                }
                            }
                        }
                    }
                }
                fldTransType.defaultValue = tranType;
                fldFrom.defaultValue = from;
                fldTo.defaultValue = to;

                var arrCashSale = [];
                var arrTrans = [];
          
                if(tranType != "") {
                    if(tranType == "all") { tranType = "cashsale|invoice|creditmemo|customerdeposit"; } 
                    arrTrans = ( tranType.indexOf("|") == -1 ) ? [tranType] : tranType.split("|");
                }
                //log.debug("selectedStudioLocations=======: ",selectedStudioLocations+" || franchisee: "+franchisee);
                //if(studioLocation && studioLocation != "" && arrTrans.length > 0) {
                if(selectedStudioLocations && arrTrans.length > 0) {
                    try {
                        var filters = [];
                        filters.push(["customer.internalid", "anyof", selectedStudioLocations]);
                        filters.push("AND");
                        filters.push(["mainline", "is", "T"]);
                        filters.push("AND");
                        filters.push(["number", "isnotempty", ""]);

                        if(from !="" && to != "") {
                            filters.push("AND");
                            filters.push(["trandate","within",from,to]);
                        }

                        for(var i=0; arrTrans != null && i<arrTrans.length; i++) {
                            var objSearch = search.create({type: arrTrans[i], filters: filters, columns: [{name: 'number'}, {name: "custentity_wave_drybar_studio_name", join: "customer", sort: "ASC"}, {name: "entityid", join: "customer", sort: "ASC"},{name: 'datecreated'}]});
                            
                            //log.debug("arrTrans[i]=======: ",arrTrans[i]+" || len: "+objSearch.length);

                            objSearch.run().each(function(result){
                                var nameStr = result.getValue({name: "custentity_wave_drybar_studio_name", join: "customer"}) || result.getValue({name: "entityid", join: "customer"});
                                arrCashSale.push({internalid: result.id, name: nameStr+" - "+result.getValue({name: "number"}), type: arrTrans[i], datecreated: result.getValue({name: "datecreated"})});
                                return true;
                            });
                        }
                    } catch (err) {
                        log.debug('Error in Catch : getCashSaleList:', 'ERR: ' + err.message);
                    }
                }
                const sortedDesc = arrCashSale.sort(function(objA, objB){ return new Date(objB.datecreated) - new Date(objA.datecreated); });

                var arrDownloadTransIds = [];
                var transListStr = '';
                if(sortedDesc.length > 0){
                    var cssStyle = '<style>';
                    cssStyle += '.active {font-weight: bold; background-color: #E5E5E5;}';
                    cssStyle += '.paging-link{font-size: 13px !important; padding: 5px; cursor: pointer;}';
                    cssStyle += '.download-current-page:hover{text-decoration: underline; cursor: pointer;}';
                    cssStyle += '.list-header-row{font-size: 13px !important; background-color: #e5e5e5 !important; height: 32px !important; vertical-align: middle !important; color: #000000; padding: 2px 5px 2px 5px !important; font-weight: bold;}';
                    cssStyle += '</style>';
                    transListStr += cssStyle;
                    transListStr += '<input type="hidden" value="" name="tranids" id="tranids">';
                    transListStr += '<input type="hidden" value="'+context.request.parameters.custpage_tran_type+'" name="type" id="type">';
                    transListStr += '<input type="hidden" value="1" name="page" id="page">';

                    transListStr += '<table width="100%" border="0" id="myTable" cellspacing="0" cellpadding="0" class="listtable listborder uir-list-table" style="position: relative;">';

                    transListStr += '<tr class="list-header-row uir-list-row-tr listtext" style=""><th style="padding: 2px 5px 2px 5px !important; font-weight: bold;"><input type="checkbox" id="select-all-cash-sale" onclick="selectAllTrans(this);" />Select All | <a onclick="downloadAllCashSale()" class="download-current-page">Download Current Page</a></th><th style="padding: 2px 5px 2px 5px !important; font-weight: bold;">Transaction Name</th><th style="padding: 2px 5px 2px 5px !important; font-weight: bold;"><a onclick="downloadAllCashSale()" class="download-current-page">Download Current Page</a></th></tr>';

                    for(var i=0; sortedDesc!=null && i<sortedDesc.length; i++) {
                        arrDownloadTransIds.push(sortedDesc[i].internalid+"||"+sortedDesc[i].type+"||"+sortedDesc[i].name);
                  
                        var rowClass = 'uir-list-row-odd';
                        if(i%2 == 0) {rowClass = 'uir-list-row-even';}
                        transListStr += '<tr class="uir-list-row-tr '+rowClass+'">';
                        transListStr += "<td class='uir-list-row-cell listtext'><label><input type='checkbox' class='chkbox-child-internalid-list' data-val='" + sortedDesc[i].internalid +"||"+sortedDesc[i].type+"||"+sortedDesc[i].name+"' value=" + sortedDesc[i].internalid + ">" + sortedDesc[i].name + "</label></td>";
                        transListStr += '<td class="uir-list-row-cell listtext">'+sortedDesc[i].name+'</td>';
                        transListStr += '<td class="uir-list-row-cell listtext"><a class="print-invoice-download-link" href="/app/site/hosting/scriptlet.nl?script=customscript_print_invoice&deploy=customdeploy_print_invoice&cashsaleid='+ sortedDesc[i].internalid +'&action=download&type='+sortedDesc[i].type+'" target="_blank">Download</a></td>';
                        transListStr += '</tr>';
                    }

                    transListStr += '</table>';
                    transListStr += '<script type="text/javascript">var $table = document.getElementById("myTable"); $n = 40; $rowCount = $table.rows.length; $firstRow = $table.rows[0].firstElementChild.tagName; $hasHead = ($firstRow === "TH"); $tr = []; var $i = ($hasHead)?1:0; var $ii = ($hasHead)?1:0; var $j = ($hasHead)?1:0; var $th = ($hasHead?$table.rows[(0)].outerHTML:""); var $pageCount = Math.ceil($rowCount / $n); ';

                    transListStr += 'if($pageCount > 1) {for ($i = $j,$ii = 0; $i < $rowCount; $i++, $ii++) {$tr[$ii] = $table.rows[$i].outerHTML;} $table.insertAdjacentHTML("afterend","<table style=\'margin-top: 5px; text-align: right;\' width=\'100%\' cellpadding=\'1\' cellspacing=\'1\'><tr><td class=\'pagination-str\'></td></tr></table>"); $table.insertAdjacentHTML("beforebegin","<table style=\'margin-bottom: 5px; text-align: right;\' width=\'100%\' cellpadding=\'1\' cellspacing=\'1\'><tr><td class=\'pagination-str\'></td></tr></table>"); sort(1);}';

                    transListStr += 'function sort($p) {var $rows = $th,$s = (($n * $p)-$n);for ($i = $s; $i < ($s+$n) && $i < $tr.length; $i++){$rows += $tr[$i];}$table.innerHTML = $rows; jQuery(".pagination-str").html(pageButtons($pageCount,$p)); jQuery(".pagination-str").html(pageButtons($pageCount,$p)); jQuery(".cls-page"+$p).addClass("active"); jQuery("#page").val($p); }';

                    //transListStr += 'function pageButtons($pCount,$cur) {var $prevDis = ($cur == 1)? "disabled":""; var $nextDis = ($cur == $pCount)?"disabled":""; var $buttons = "<input type=\'button\' value=\'<< Prev\' "+$prevDis+" onclick=\'sort("+($cur - 1)+")\'>"; for ($i=1; $i<=$pCount;$i++) {$buttons += "<input type=\'button\' id=\'id"+$i+"\' onclick=\'sort("+$i+")\' value=\'"+$i+"\'>";} $buttons += "<input type=\'button\' value=\'Next >>\' onclick=\'sort("+($cur + 1)+")\' "+$nextDis+">"; return $buttons; }';

                    transListStr += 'function pageButtons($pCount,$cur) {var $prevDis = ($cur == 1)? "hidden":"visible"; var $nextDis = ($cur == $pCount)?"none":""; var $buttons = "<a class=\'paging-link\' style=\'visibility: "+$prevDis+";\' onclick=\'sort("+($cur - 1)+")\'><< Prev</a>"; for ($i=1; $i<=$pCount;$i++) { $buttons += "<a class=\'paging-link cls-page"+$i+"\' id=\'id"+$i+"\' onclick=\'sort("+$i+")\'>"+$i+"</a>";} $buttons += "<a onclick=\'sort("+($cur + 1)+")\' class=\'paging-link\' style=\'display: "+$nextDis+";\'>Next >></a>"; return $buttons; }';

                    transListStr += 'function selectAllTrans(objThis) {var checked = jQuery("#select-all-cash-sale").is(":checked"); if(checked) {jQuery(".chkbox-child-internalid-list").each(function() { jQuery(this).prop("checked",true); }); } else { jQuery(".chkbox-child-internalid-list").each(function(){ jQuery(this).prop("checked",false); }); }}';

                    var downloadAllURL = runtime.getCurrentScript().getParameter({name: 'custscript_download_all_page_url'});
                    if(downloadAllURL != "") {
                        transListStr += 'function downloadAllCashSale(){var arrCashSaleId = []; jQuery(".chkbox-child-internalid-list").each(function(){ if( jQuery(this).prop("checked") ) arrCashSaleId.push( jQuery(this).attr("data-val") );}); var currentPage = jQuery("#page").val() || 1; var transactionType = "'+context.request.parameters.custpage_tran_type+'" || "all"; if(arrCashSaleId.length==0) {alert("Please select alteast one record to download."); } else { jQuery("#tranids").val( arrCashSaleId.join() ); jQuery("#type").val( transactionType ); jQuery("#page").val( currentPage ); jQuery("#transaction_tab_form").attr("action", "'+downloadAllURL+'"); jQuery("#transaction_tab_form").attr("target", "_blank"); jQuery("#transaction_tab_form").submit(); }}';
                    }

                    transListStr += '</script>';
                } else {
                    transListStr += '<table style=\'margin-top: 10px; text-align: left;\' width=\'100%\' cellpadding=\'1\' cellspacing=\'1\'><tr><td id=\'buttons\'><strong>No records found for the selected criteria.</strong></td></tr></table>';
                }

                fldTransList.defaultValue = transListStr;

                context.response.writePage(form);
            }
        }

        return {
            onRequest: onRequest
        };
    });
