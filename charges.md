this is the api get offer charges by offer ID
Get the estimated charges for an offer, evaluated live for both in_stock and leadtime order types.

Authorizations:
api_key
path Parameters
offer_id
required
integer <int32> (OfferID) >= 1
Example: 1234567890
Takealot offer ID

query Parameters
selling_price	
number <double> decimal places <= 2 >= 0
Example: selling_price=199.99
Price to evaluate the offer's charges at. Defaults to the offer's current selling price if not provided.

Responses
200 Response payload for getting an offer's charges
Response Schema: application/json
Array 
order_type	
string
Enum: "in_stock" "leadtime"
The type of order these charges apply to.

estimated_success_fee	
number <double> decimal places <= 2
Estimated fee associated with the successful completion of a sale of this offer.

estimated_fulfilment_fee	
number <double> decimal places <= 2
Estimated fee charged for fulfilling the order when this offer is sold.

other_costs	
number <double> decimal places <= 2
Any additional costs associated with the order that don't have a dedicated field.

403 API key is missing or invalid
4XX HTTP 400 errors with sub-types
5XX HTTP 500 errors with sub-types
default General response format for non-200 responses


See as we have. The sync button. To sync the offers with the. Our database. So I want one more option there. When we click on sync Offer. So there will be, there should be an Button to turn off and off, on and off. The button will say that. Including charges. Estimated charges. And when user tabs on it so it should show. It it will Increase the time. So if that is true so when we fetching. So when we enqueueing the sync task to the. Q for the worker, so we will also put there that. Estimate charges. Calculation. Is true or false? In boolean value so if true so where will be fetching? Charges for each Offer. I mean estimated charges for each offer. For that there will be a extra worker. So when sync worker. Get the first batch of hundred offers, so it put the. Array of offer IDS to a new queue which will be. Fetching the charges. In saving it to our database. We will be making an extra field in our database For take a lot of our table For the charges, there will be Extra field like estimated success fee, estimated fulfillment fee, estimated other costs. So once our worker. Faces. Fetch  So it will upsert  in. A batch ND Server Side Events. We will be sending. Two progress, one for the. Offer sync and one for  Charges calculation.  Now how we will be calculating the charges we will be calling this API that we have mentioned. With the payload of. Selling price in the offer ID that we will be getting from the. job in queue 