List Transactions
List transactions.

This endpoint allows you to retrieve a list of transactions based on various filters.

The transactions are returned in descending order of their transaction_id, meaning the most recent transactions will be listed first.

Note: The maximum allowable date range is 180 days, and the default will show the last 30 days.

Authorizations:
api_key
query Parameters
transaction_type__in	
Array of strings (TransactionTypeEnum) [ items >= 1 ]
Items Enum	Description
charge-subscription-fee	A monthly subscription fee charge
charge-fulfilment-fee	A fulfilment fee associated with a customer order
charge-storage-fee	A storage fee charged for stock in warehouse
charge-success-fee	A success fee associated with a customer order
reversal-success-fee	A success fee reversal for a return/cancellation
payment-customer-order	A customer order payment
reversal-customer-order	A reversal for a customer order payment
disbursement-disbursement	A disbursement transaction
reversal-disbursement	A disbursement transaction reversal
payment-eft-payment	An eft payment
charge-manual	A manual fee charge
disbursement-manual	A manual disbursement
reversal-manual	A manual reversal of a transaction
payment-manual	A manual payment
payment-debit-order	A debit order payment
reversal-debit-order	A debit order reversal
payment-storage-fee-rebate	A storage fee rebate
reversal-storage-fee-rebate-reversal	A storage fee rebate reversal
charge-order-cancellation-penalty	An order cancellation penalty
charge-courier-collection-fee	A courier collection fee associated with an order
charge-removal-order	A removal order fee
charge-stock-transfer-fee	A stock transfer fee associated with an order
charge-ad-credit-purchase	A sponsored ad credit purchase
reversal-fulfilment-fee	A reversal of a fulfilment fee
reversal-courier-collection-fee	A reversal of a courier collection fee
reversal-removal-order-fee-reversal	A reversal of a removal order fee
payment-stock-loss-payment	A stock loss payment
reversal-stock-loss-reversal	A stock loss payment reversal
charge-stock-loss-success-fee	A stock loss success fee charge
reversal-stock-loss-success-fee-reversal	A reversal of a stock loss success fee charge
charge-stock-loss-fulfilment-fee	A stock loss fulfillment fee charge
reversal-stock-loss-fulfilment-fee-reversal	A reversal of a stock loss fulfillment fee charge
payment-return-dispute-payment	A return dispute payment
charge-removal-order-fee	A removal order fee
charge-takealot-removal-order-fee	A Takealot removal order fee
charge-returns-removal-order-fee	A returns removal order fee
funding-repayment-funding-repayment-seller-capital	A Seller Capital funding repayment
Example: transaction_type__in=charge-success-fee&transaction_type__in=payment-customer-order
Return only transactions of these types.

created_at__gte	
string <date-time>
Example: created_at__gte=2025-01-01T00:00:00+02:00
Default: now - 30 days

The transaction created_at must be greater than or equal to this value. (The start date for the query).

Must not be in the future.

created_at__lte	
string <date-time>
Example: created_at__lte=2025-01-31T23:59:59+02:00
Default: now

The transaction created_at must be less than or equal to this value. (The end date for the query).

Must not be in the future.

limit	
integer [ 1 .. 100 ]
Default: 20
Example: limit=50
The number of transactions per page.

fields	
Array of strings
Items Enum: "transaction_id" "transaction_type" "amount_incl_vat" "vat_multiplier" "created_at"
Example: fields=transaction_id&fields=transaction_type&fields=amount_incl_vat&fields=created_at
Return only these fields.

expands	
Array of strings
Items Value: "references"
Example: expands=references
Expand the response with related entities.

continuation_token	
string >= 1
Example: continuation_token=eyJvZmZzZXQiOiAxMDB9
Continuation token to get the next page of results. Obtained from a previous response.

include_count	
boolean
Default: false
Example: include_count=true
Include a count of total items in the response.

Responses
200 Response payload for listing transactions
Response Schema: application/json
items	
Array of objects (TransactionWithReferences)
The list of transactions in this page of results.

Array 
transaction_id	
integer
Unique identifier for the transaction.

transaction_type	
string (TransactionTypeEnum)
Enum	Description
charge-subscription-fee	A monthly subscription fee charge
charge-fulfilment-fee	A fulfilment fee associated with a customer order
charge-storage-fee	A storage fee charged for stock in warehouse
charge-success-fee	A success fee associated with a customer order
reversal-success-fee	A success fee reversal for a return/cancellation
payment-customer-order	A customer order payment
reversal-customer-order	A reversal for a customer order payment
disbursement-disbursement	A disbursement transaction
reversal-disbursement	A disbursement transaction reversal
payment-eft-payment	An eft payment
charge-manual	A manual fee charge
disbursement-manual	A manual disbursement
reversal-manual	A manual reversal of a transaction
payment-manual	A manual payment
payment-debit-order	A debit order payment
reversal-debit-order	A debit order reversal
payment-storage-fee-rebate	A storage fee rebate
reversal-storage-fee-rebate-reversal	A storage fee rebate reversal
charge-order-cancellation-penalty	An order cancellation penalty
charge-courier-collection-fee	A courier collection fee associated with an order
charge-removal-order	A removal order fee
charge-stock-transfer-fee	A stock transfer fee associated with an order
charge-ad-credit-purchase	A sponsored ad credit purchase
reversal-fulfilment-fee	A reversal of a fulfilment fee
reversal-courier-collection-fee	A reversal of a courier collection fee
reversal-removal-order-fee-reversal	A reversal of a removal order fee
payment-stock-loss-payment	A stock loss payment
reversal-stock-loss-reversal	A stock loss payment reversal
charge-stock-loss-success-fee	A stock loss success fee charge
reversal-stock-loss-success-fee-reversal	A reversal of a stock loss success fee charge
charge-stock-loss-fulfilment-fee	A stock loss fulfillment fee charge
reversal-stock-loss-fulfilment-fee-reversal	A reversal of a stock loss fulfillment fee charge
payment-return-dispute-payment	A return dispute payment
charge-removal-order-fee	A removal order fee
charge-takealot-removal-order-fee	A Takealot removal order fee
charge-returns-removal-order-fee	A returns removal order fee
funding-repayment-funding-repayment-seller-capital	A Seller Capital funding repayment
The type of transaction

Transaction types are generally grouped into the following categories:

charge: A fee charged to the seller, such as a subscription fee, fulfilment fee, storage fee, or success fee.
payment: A payment made to the seller, such as a customer order payment, disbursement, or rebate payment.
reversal: A reversal of a previous charge or payment, such as a success fee reversal, customer order payment reversal, or disbursement reversal.
disbursement: A disbursement to the seller, which may be a regular automated disbursement or a manual disbursement.
funding-repayment: A repayment of funding, such as a Seller Capital funding repayment.
amount_incl_vat	
number
Total amount including VAT.

vat_multiplier	
number
Multiplier to calculate the VAT amount from the amount including VAT.

created_at	
string <date-time>
The date and time when the transaction was created.

references	
object (TransactionReference)
The references associated with this transaction, providing context such as order, offer, or return identifiers.

count	
integer (Count)
Total count of items available with the given filters.

limit	
integer (Limit)
The maximum number of items returned at a time in the response.

continuation_token	
string (ContinuationToken)
A token to retrieve the next page of results. If not provided, there are no more results.

403 API key is missing or invalid
4XX HTTP 500 errors with sub-types
5XX HTTP 500 errors with sub-types
default General response format for non-200 responses