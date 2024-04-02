/**
 * @NApiVersion 2.0
 * @NScriptType ClientScript
 * @NModuleScope Public
 */

define(['N/search', 'N/currentRecord'], function(search, currentRecord) {
    var record = currentRecord.get();

    function fieldChanged(context) {
        if(context.fieldId == 'custpage_franchisee') {
            var franchisee = record.getValue('custpage_franchisee');

            if(franchisee == '') {return;}

            var studioSearch = search.create({
                type: 'customer',
                filters: [['parent','is',franchisee], "AND", ['isinactive','is','F']],
                columns: ['entityid','companyname','parent','custentity_wave_drybar_studio_name']
            });

            var studioSearchResults = studioSearch.run().getRange({ start: 0, end: 1000 });

            var fldStudioLocation = record.getField('custpage_studio_location');
            //fldStudioLocation.isMandatory = true;
            fldStudioLocation.removeSelectOption({value : null});
            if(studioSearchResults.length != 0) {
                for(var i in studioSearchResults) {
                    if(studioSearchResults[i].getValue('parent')){
                        if(franchisee != studioSearchResults[i].id) {
                            fldStudioLocation.insertSelectOption({
                                value : studioSearchResults[i].id,
                                text : studioSearchResults[i].getValue('custentity_wave_drybar_studio_name') || studioSearchResults[i].getValue('entityid') 
                            });
                        }
                    }
                }
            }
        }

        return true;
    }

    return { 
        fieldChanged : fieldChanged
    };
});