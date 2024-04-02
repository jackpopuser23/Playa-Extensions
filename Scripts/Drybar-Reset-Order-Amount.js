/**
 *@NApiVersion 2.0
 *@NScriptType ScheduledScript
*/

/* ************************************************************************
 * Company:     The Vested Group, www.thevested.com
 *
 *
 * Purpose -
 * 1) Reset the Monthly Order Amount (custentity_wave_month_order_amt) custom    
 * entity field value to Zero once in a month at end of the month (Drybar - B2B)
 ***********************************************************************/

define(['N/runtime', 'N/search', 'N/record', 'N/log', 'N/task'],
    function(runtime, search, record, log, task){
        var arrCustomers = [];
        function execute(context){
            var currentScript = runtime.getCurrentScript();
            var customerSource = currentScript.getParameter({name: 'custscript_customer_source'}); // 7 => Drybar (Franchisee)
			customerSource = ( customerSource.indexOf(",") == -1 ) ? [customerSource] : customerSource.split(",");
            
            if(customerSource && customerSource != "") {
                var searchRecord = search.create({
                    type: 'customer',
                    filters: [['custentity_wave_customer_source', 'anyof', customerSource], 'AND', ['custentity_wave_month_order_restriction', 'is', 'T'], 'AND', ['isinactive', 'is', 'F']],
                    columns: [search.createColumn({name: "internalid"})]
                });
                var searchresult = searchRecord.run().each(function(result){
                    arrCustomers.push( result.getValue({name: 'internalid'}) );
                    return true;
                });
                log.debug("arrCustomers: ",JSON.stringify(arrCustomers));
                if(arrCustomers && arrCustomers.length > 0){
                    for(var i = 0; i < arrCustomers.length; i++) {
                        var customerId = arrCustomers[i];
                        try{
                            record.submitFields({
                                type: 'customer',
                                id: customerId,
                                values: {custentity_wave_month_order_amt: '0'}
                            });
                            log.debug("customerId: ",customerId);
                        } catch(err) {
                            log.debug("DEBUG", "IN CATCH: Update Monthly Order Amount: "+JSON.stringify(err));
                        }
                    }
                }
            }
        }
		
        return{
            execute: execute
        };
    }
);
