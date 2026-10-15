import { Access } from "@prisma/client";
import type { AgentToolDefinition } from "./schemas";

export const agentToolRegistry: readonly AgentToolDefinition[] = [
	{
		name: "takealot_tool",
		description: "Priority source for Takealot marketplace data. Use for Takealot-specific revenue, fees, orders, product performance, sales trends, breakdowns, and stock history; do not substitute POS sales or finance reports. Profit is an estimate using current exact-SKU catalog average costs, and is unavailable when any sold units lack a cost match or any sales rows lack total_fee.",
		operations: ["sales_summary", "sales_trends", "sales_breakdown", "product_performance", "list_sales", "list_orders", "overview", "inventory_summary", "inventory_snapshots"],
		operationDescriptions: {
			sales_summary: "Aggregate Takealot sales for required from/to YYYY-MM-DD dates. Returns gross selling_price revenue, quantity, unique orders, reported total_fee, fee components when complete, cost coverage, and estimated merchandise profit only when every unit matches a current catalog averageCost and every row has total_fee. Use first for questions about Takealot revenue, fees, or profit.",
			sales_trends: "Date-filtered Takealot time series. Requires from/to; interval is day, week, or month and metric is revenue, units, or orders. Includes totalFee per time bucket. Use for trends or charts.",
			sales_breakdown: "Date-filtered Takealot sales grouped by promotion, saleStatus, dc, customerDc, or stockSourceRegion. Requires from/to and groupBy.",
			product_performance: "Date-filtered Takealot product rankings and summary. Requires from/to; supports sortBy, order, page, limit, SKU, title, and TSIN filters. Product profit is estimated from current exact-SKU catalog averageCost and is null when fee or cost coverage is incomplete.",
			list_sales: "Date-filtered Takealot sale rows with marketplace fee fields when supplied by Takealot. Supports from/to, sale filters, page, and limit up to 100; this returns one page, not the full result set.",
			list_orders: "Date-filtered Takealot order or sale records with optional SKU, product title, TSIN, and order ID filters. Requires from/to and returns one page, up to 100 records.",
			overview: "Current Takealot stock counts/health and the seller API's fixed sales-summary periods. A requested date range is not applied to those fixed periods; never use these totals as an answer for a custom date range.",
			inventory_summary: "Fetch current Takealot stock counts and stock-health statistics, and save an inventory snapshot for later historical comparison.",
			inventory_snapshots: "Read previously saved Takealot inventory snapshots for required from/to YYYY-MM-DD dates. It returns only snapshots actually captured; no snapshot means no historical observation, not zero stock.",
		},
		requiredAccessByOperation: {
			sales_summary: Access.TAKEALOT,
			sales_trends: Access.TAKEALOT,
			sales_breakdown: Access.TAKEALOT,
			product_performance: Access.TAKEALOT,
			list_sales: Access.TAKEALOT,
			list_orders: Access.TAKEALOT,
			overview: Access.TAKEALOT,
			inventory_summary: Access.TAKEALOT,
			inventory_snapshots: Access.TAKEALOT,
		},
	},
	{
		name: "customer_tool",
		description: "Customer search, reporting, and management operations.",
		operations: ["list_customers", "customer", "customer_summary", "customer_metrics", "customer_payments", "top_customers", "recent_customers", "create_customer", "update_customer", "delete_customer", "record_customer_payment"],
		requiredAccessByOperation: {
			list_customers: Access.CUSTOMERS,
			customer: Access.CUSTOMERS,
			customer_summary: Access.CUSTOMERS,
			customer_metrics: Access.REPORT_INVENTORY_CUSTOMER,
			customer_payments: Access.CUSTOMERS,
			top_customers: Access.REPORT_INVENTORY_CUSTOMER,
			recent_customers: Access.REPORT_INVENTORY_CUSTOMER,
			create_customer: Access.CUSTOMERS,
			update_customer: Access.CUSTOMERS,
			delete_customer: Access.CUSTOMERS,
			record_customer_payment: Access.CUSTOMERS,
		},
	},
	{
		name: "sales_tool",
		description: "Sales, invoices, transactions, and sale lifecycle operations.",
		operations: ["sales_dashboard", "sales_transactions", "list_sales", "get_sale", "create_sale_draft", "update_sale_draft", "complete_sale", "cancel_sale"],
		requiredAccessByOperation: { sales_dashboard: Access.REPORT_SALES, sales_transactions: Access.REPORT_SALES, list_sales: Access.POS, get_sale: Access.POS, create_sale_draft: Access.POS, update_sale_draft: Access.POS, complete_sale: Access.POS, cancel_sale: Access.POS },
	},
	{
		name: "inventory_tool",
		description: "Inventory, stock, movements, and stock reporting operations.",
		operations: ["inventory_list", "inventory_summary", "product_inventory", "stock_movements", "set_opening_stock", "adjust_stock", "inventory_dashboard", "low_stock_items"],
		requiredAccessByOperation: { inventory_list: Access.INVENTORY, inventory_summary: Access.INVENTORY, product_inventory: Access.INVENTORY, stock_movements: Access.INVENTORY, set_opening_stock: Access.INVENTORY, adjust_stock: Access.INVENTORY, inventory_dashboard: Access.REPORT_INVENTORY_CUSTOMER, low_stock_items: Access.REPORT_INVENTORY_CUSTOMER },
	},
	{
		name: "catalog_tool",
		description: "Products, categories, brands, and catalog management.",
		operations: ["list_categories", "get_category", "create_category", "update_category", "delete_category", "list_brands", "get_brand", "create_brand", "update_brand", "delete_brand", "list_products", "get_product", "create_product", "update_product", "delete_product", "add_product_images", "reorder_product_images", "remove_product_image", "update_brand_logo", "remove_brand_logo", "update_category_logo", "remove_category_logo"],
		requiredAccessByOperation: { list_categories: Access.CATEGORIES, get_category: Access.CATEGORIES, create_category: Access.CATEGORIES, update_category: Access.CATEGORIES, delete_category: Access.CATEGORIES, list_brands: Access.BRANDS, get_brand: Access.BRANDS, create_brand: Access.BRANDS, update_brand: Access.BRANDS, delete_brand: Access.BRANDS, list_products: Access.PRODUCTS, get_product: Access.PRODUCTS, create_product: Access.PRODUCTS, update_product: Access.PRODUCTS, delete_product: Access.PRODUCTS },
	},
	{
		name: "purchasing_tool",
		description: "Suppliers, purchase orders, receiving, and supplier payments.",
		operations: ["list_suppliers", "supplier_summary", "get_supplier", "create_supplier", "update_supplier", "delete_supplier", "list_purchase_orders", "purchase_order_summary", "get_purchase_order", "create_purchase_order", "update_purchase_order", "receive_purchase_order", "record_supplier_payment", "list_supplier_payments", "list_supplier_account_payments", "cancel_purchase_order"],
		requiredAccessByOperation: { list_suppliers: Access.PURCHASES, supplier_summary: Access.PURCHASES, get_supplier: Access.PURCHASES, create_supplier: Access.PURCHASES, update_supplier: Access.PURCHASES, delete_supplier: Access.PURCHASES, list_purchase_orders: Access.PURCHASES, purchase_order_summary: Access.PURCHASES, get_purchase_order: Access.PURCHASES, create_purchase_order: Access.PURCHASES, update_purchase_order: Access.PURCHASES, receive_purchase_order: Access.PURCHASES, record_supplier_payment: Access.PURCHASES, list_supplier_payments: Access.PURCHASES, list_supplier_account_payments: Access.PURCHASES, cancel_purchase_order: Access.PURCHASES },
	},
	{
		name: "finance_tool",
		description: "Financial data and reporting. Use list_expenses for requests to see, show, find, or review expenses; use expense_summary or expense_analytics for totals, trends, or category breakdowns; use pnl_dashboard for profit and loss.",
		operations: ["list_expenses", "get_expense", "expense_summary", "expense_analytics", "create_expense", "update_expense", "remove_expense", "pnl_dashboard", "recent_expenses"],
		requiredAccessByOperation: { list_expenses: Access.EXPENSES, get_expense: Access.EXPENSES, expense_summary: Access.EXPENSES, expense_analytics: Access.EXPENSES, create_expense: Access.EXPENSES, update_expense: Access.EXPENSES, remove_expense: Access.EXPENSES, pnl_dashboard: Access.REPORT_PROFIT_LOSS, recent_expenses: Access.EXPENSES },
	},
	{
		name: "returns_tool",
		description: "Returnable items, return history, summaries, and return creation.",
		operations: ["returnable_items", "list_returns_for_sale", "list_returns", "return_summary", "return_analytics", "create_return"],
		requiredAccessByOperation: { returnable_items: Access.POS, list_returns_for_sale: Access.POS, list_returns: Access.RETURNS, return_summary: Access.RETURNS, return_analytics: Access.RETURNS, create_return: Access.RETURNS },
	},
	{
		name: "company_tool",
		description: "Company settings and authorized user administration.",
		operations: ["get_company", "update_company", "list_company_users", "create_company_user", "update_company_user", "deactivate_company_user", "list_available_accesses"],
		requiredAccessByOperation: { get_company: Access.SETTINGS, update_company: Access.SETTINGS, list_company_users: Access.USERS_ROLES, create_company_user: Access.USERS_ROLES, update_company_user: Access.USERS_ROLES, deactivate_company_user: Access.USERS_ROLES, list_available_accesses: Access.USERS_ROLES },
	},
	{
		name: "media_upload_tool",
		description: "Generate secure media upload requests for supported business targets.",
		operations: ["create_upload_url"],
		requiredAccessByOperation: { create_upload_url: Access.SETTINGS },
	},
	{
		name: "email_tool",
		description: "Use this tool when the user asks you to compose and send an email. Creates a professional custom HTML email containing recipient(s), subject, HTML body, and type 'custom'. Before sending, the user MUST explicitly approve the draft preview.",
		operations: ["send_custom_email"],
		requiredAccessByOperation: { send_custom_email: Access.CUSTOMERS },
	},
] as const;

export const findAgentTool = (name: string, operation: string) => {
	const tool = agentToolRegistry.find((item) => item.name === name);
	if (!tool || !tool.operations.includes(operation)) return undefined;
	return tool;
};
