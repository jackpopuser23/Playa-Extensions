/* ************************************************************************
 * Company:		The Vested Group, www.thevested.com
 * Author:	    Neeraj Shukla
 * Script:		SO: Shipping Method & Cost
 * Applies To:	Sales Order through the website
 *
 *
 * This client script includes below functionality
 *		1) This script is used to set the shipping cost of HoT & Wave Items separately
 *
 * Version    Date            Author           	Remarks
 * 1.00       29 Dec 2021     NEERAJ			
 *
 ***********************************************************************/

function setSalesOrderShippingCost(type, fieldinternalid, linenum)
{
	if (nlapiGetContext().getExecutionContext() !== 'webstore') {return true};

	if(fieldinternalid == "custbody_hot_item_shipping_cost" || fieldinternalid == "custbody_wave_item_shipping_cost" || fieldinternalid == "custbody_source_domain")
	{
		var hotItemShippingCost  = nlapiGetFieldValue("custbody_hot_item_shipping_cost");
		var waveItemShippingCost = nlapiGetFieldValue("custbody_wave_item_shipping_cost");
		var currentSourceDomain  = nlapiGetFieldValue("custbody_source_domain");

		if( currentSourceDomain == '10' ) // Applied to Drybar website
		{
			if( waveItemShippingCost && hotItemShippingCost)
			{
				var finalShippingCost = Number(waveItemShippingCost)+Number(hotItemShippingCost); 
			}
			else
			{
				var finalShippingCost = Number(waveItemShippingCost);
			}

			nlapiLogExecution('DEBUG', 'hotItemShippingCost::::', "hotItemShippingCost: "+hotItemShippingCost);
			nlapiLogExecution('DEBUG', 'waveItemShippingCost::::', "waveItemShippingCost: "+waveItemShippingCost);
			nlapiLogExecution('DEBUG', 'currentSourceDomain::::', "currentSourceDomain: "+currentSourceDomain);
			nlapiLogExecution('DEBUG', 'finalShippingCost::::: '+type, "finalShippingCost: "+finalShippingCost);

			nlapiSetFieldValue("shippingcost", finalShippingCost);
		}
	}
}