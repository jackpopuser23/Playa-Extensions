function service(request, response)
{
	var status = "FAIL";
	var returnval = "";
	try 
	{
		var order = nlapiGetWebContainer().getShoppingSession().getOrder();

		var items = JSON.parse( request.getParameter('items') );
		if(items)
		{
			for(var i=0; i<items.length; i++)
			{
				if( items[i].internalid && items[i].quantity ) 
				{
					try {
						returnval = order.addItem( {internalid: items[i].internalid.toString(), quantity: items[i].quantity} );
						status = "SUCCESS";
					}
					catch(err) {
						nlapiLogExecution('DEBUG', "ERR IN ITEM LOOP: ITEM-ID: "+ items[i].internalid, err);
						returnval = "";
						status = "FAIL";
					}
				}
			}
		}
	}
	catch(err) {
		nlapiLogExecution('DEBUG', "try-catch-error", err);
		returnval = "";
		status = "FAIL";
	}

	response.setContentType('JSON');
	var jsonObj = {'status': status, 'returnval': returnval};

	response.write( JSON.stringify(jsonObj) );
}


function service_ITEMS(request, response)
{
	var status = "FAIL";
	var returnval = "";

	try 
	{
		var order = nlapiGetWebContainer().getShoppingSession().getOrder();
		var returnValues = "";

		var items = JSON.parse( request.getParameter('items') );
		if(items)
		{
			var objItems = [];
			for(var i=0; i<items.length; i++){
				if( items[i].internalid && items[i].quantity ) 
					objItems.push( {internalid: items[i].internalid.toString(), quantity: items[i].quantity} ); 
			}

			returnValues = order.addItems( objItems );
			returnval = returnValues;
			status = "SUCCESS";
		}
	}
	catch(err) {
		nlapiLogExecution('DEBUG', "try-catch-error", err);
		returnval = "";
		status = "FAIL";
	}

	response.setContentType('JSON');
	var jsonObj = {'status': status, 'returnval': returnval};

	response.write( JSON.stringify(jsonObj) );
}