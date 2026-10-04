import * as customers from "../../customers/service";
import * as reports from "../../reports/service";
import * as sales from "../../sales/service";
import * as inventory from "../../inventory/service";
import * as expenses from "../../expenses/service";
import * as catalog from "../../catalog/service";
import * as purchases from "../../purchases/service";
import * as company from "../../company/service";
import { findAgentTool } from "../registry";
import type { AgentGraphState } from "./state";
import { interrupt } from "@langchain/langgraph";

const safeFailure = (safeMessage: string) => ({
	success: false as const,
	errorCode: "AGENT_OPERATION_UNAVAILABLE",
	safeMessage,
	retryable: false,
});

import type { AgentPerfTracker } from "../utils/perfLogger";

export const executePlan = async (state: AgentGraphState, tracker?: AgentPerfTracker) => {
	const plan = state.plan;
	if (!plan) return { stepResults: {} };
	const stepResults: Record<string, unknown> = {};

	for (const step of plan.steps) {
		if (step.type !== "tool") continue;
		if (step.requiresConfirmation) {
			const response = interrupt({
				type: "confirmation",
				question: `Continue with: ${step.description}?`,
				options: [
					{ id: "confirm", label: "Continue" },
					{ id: "cancel", label: "Cancel" },
				],
			}) as { selectedOption?: string };
			if (response?.selectedOption !== "confirm") {
				stepResults[step.id] = safeFailure("The requested action was cancelled.");
				continue;
			}
		}
		const definition = findAgentTool(step.tool, step.operation);
		if (!definition) {
			stepResults[step.id] = safeFailure("That capability is not available.");
			continue;
		}
		const requiredAccess = definition.requiredAccessByOperation[step.operation];
		if (requiredAccess && !state.user.permissions.includes(requiredAccess)) {
			stepResults[step.id] = safeFailure("You do not have access to complete that request.");
			continue;
		}
		try {
			tracker?.log({
				layer: "langgraph",
				module: "executor.ts",
				operation: "tool start",
				toolCallId: step.id,
				extra: { tool: step.tool, op: step.operation },
			});
			const args = step.args;
			switch (`${step.tool}:${step.operation}`) {
				case "customer_tool:list_customers":
					stepResults[step.id] = { success: true, data: await customers.listCustomers(state.user.companyId, customers.listSchema.parse(args)) };
					break;
				case "customer_tool:customer":
					stepResults[step.id] = { success: true, data: await customers.getCustomer(state.user.companyId, String(args.id)) };
					break;
				case "customer_tool:customer_summary":
					stepResults[step.id] = { success: true, data: await customers.getCustomerSummary(state.user.companyId, String(args.id)) };
					break;
				case "customer_tool:customer_metrics":
					stepResults[step.id] = { success: true, data: await customers.getSummary(state.user.companyId, typeof args.from === "string" ? args.from : undefined, typeof args.to === "string" ? args.to : undefined) };
					break;
				case "customer_tool:customer_payments":
					stepResults[step.id] = { success: true, data: await customers.listPayments(state.user.companyId, String(args.customerId), customers.paymentListSchema.parse(args)) };
					break;
				case "customer_tool:top_customers":
					stepResults[step.id] = { success: true, data: await reports.topCustomers(state.user.companyId, reports.dashboardSchema.parse(args)) };
					break;
				case "customer_tool:recent_customers":
					stepResults[step.id] = { success: true, data: await reports.recentCustomers(state.user.companyId, reports.dashboardSchema.parse(args)) };
					break;
				case "sales_tool:sales_dashboard":
					stepResults[step.id] = { success: true, data: await reports.salesDashboard(state.user.companyId, reports.dashboardSchema.parse(args)) };
					break;
				case "sales_tool:sales_transactions":
					stepResults[step.id] = { success: true, data: await reports.salesTransactions(state.user.companyId, reports.pageSchema.parse(args)) };
					break;
				case "sales_tool:list_sales":
					stepResults[step.id] = { success: true, data: await sales.listSales(state.user.companyId, sales.saleListSchema.parse(args)) };
					break;
				case "sales_tool:get_sale":
					stepResults[step.id] = { success: true, data: await sales.getSale(state.user.companyId, String(args.saleId)) };
					break;
				case "inventory_tool:inventory_list":
					stepResults[step.id] = { success: true, data: await inventory.listInventory(state.user.companyId, inventory.listSchema.parse(args)) };
					break;
				case "inventory_tool:inventory_summary":
					stepResults[step.id] = { success: true, data: await inventory.getSummary(state.user.companyId) };
					break;
				case "inventory_tool:product_inventory":
					stepResults[step.id] = { success: true, data: await inventory.getProductInventory(state.user.companyId, String(args.productId)) };
					break;
				case "inventory_tool:stock_movements":
					stepResults[step.id] = { success: true, data: await inventory.listMovements(state.user.companyId, String(args.productId), inventory.movementListSchema.parse(args)) };
					break;
				case "inventory_tool:inventory_dashboard":
					stepResults[step.id] = { success: true, data: await reports.inventoryDashboard(state.user.companyId, reports.dashboardSchema.parse(args)) };
					break;
				case "inventory_tool:low_stock_items":
					stepResults[step.id] = { success: true, data: await reports.lowStockItems(state.user.companyId, reports.pageSchema.parse(args)) };
					break;
				case "finance_tool:list_expenses":
					stepResults[step.id] = { success: true, data: await expenses.list(state.user.companyId, expenses.expenseListSchema.parse(args)) };
					break;
				case "finance_tool:get_expense":
					stepResults[step.id] = { success: true, data: await expenses.get(state.user.companyId, String(args.id)) };
					break;
				case "finance_tool:expense_summary":
					stepResults[step.id] = { success: true, data: await expenses.summary(state.user.companyId, expenses.summarySchema.parse(args)) };
					break;
				case "finance_tool:expense_analytics":
					stepResults[step.id] = { success: true, data: await expenses.analytics(state.user.companyId, expenses.summarySchema.parse(args)) };
					break;
				case "finance_tool:pnl_dashboard":
					stepResults[step.id] = { success: true, data: await reports.pnlDashboard(state.user.companyId, reports.dashboardSchema.parse(args)) };
					break;
				case "finance_tool:recent_expenses":
					stepResults[step.id] = { success: true, data: await reports.recentExpenses(state.user.companyId, reports.dashboardSchema.parse(args)) };
					break;
				case "catalog_tool:list_categories":
					stepResults[step.id] = { success: true, data: await catalog.listCategories(state.user.companyId, catalog.categoryListSchema.parse(args)) };
					break;
				case "catalog_tool:get_category":
					stepResults[step.id] = { success: true, data: await catalog.getCategory(state.user.companyId, String(args.id)) };
					break;
				case "catalog_tool:list_brands":
					stepResults[step.id] = { success: true, data: await catalog.listBrands(state.user.companyId, catalog.brandListSchema.parse(args)) };
					break;
				case "catalog_tool:get_brand":
					stepResults[step.id] = { success: true, data: await catalog.getBrand(state.user.companyId, String(args.id)) };
					break;
				case "catalog_tool:list_products":
					stepResults[step.id] = { success: true, data: await catalog.listProducts(state.user.companyId, catalog.productListSchema.parse(args)) };
					break;
				case "catalog_tool:get_product":
					stepResults[step.id] = { success: true, data: await catalog.getProduct(state.user.companyId, String(args.id)) };
					break;
				case "purchasing_tool:list_suppliers":
					stepResults[step.id] = { success: true, data: await purchases.listSuppliers(state.user.companyId, purchases.supplierListSchema.parse(args)) };
					break;
				case "purchasing_tool:supplier_summary":
					stepResults[step.id] = { success: true, data: await purchases.supplierSummary(state.user.companyId) };
					break;
				case "purchasing_tool:get_supplier":
					stepResults[step.id] = { success: true, data: await purchases.getSupplier(state.user.companyId, String(args.supplierId)) };
					break;
				case "purchasing_tool:list_purchase_orders":
					stepResults[step.id] = { success: true, data: await purchases.listPurchaseOrders(state.user.companyId, purchases.purchaseListSchema.parse(args)) };
					break;
				case "purchasing_tool:purchase_order_summary":
					stepResults[step.id] = { success: true, data: await purchases.purchaseOrderSummary(state.user.companyId) };
					break;
				case "purchasing_tool:get_purchase_order":
					stepResults[step.id] = { success: true, data: await purchases.getPurchaseOrder(state.user.companyId, String(args.orderId)) };
					break;
				case "purchasing_tool:list_supplier_payments":
					stepResults[step.id] = { success: true, data: await purchases.listSupplierPayments(state.user.companyId, String(args.orderId), purchases.paymentListSchema.parse(args)) };
					break;
				case "purchasing_tool:list_supplier_account_payments":
					stepResults[step.id] = { success: true, data: await purchases.listSupplierAccountPayments(state.user.companyId, String(args.supplierId), purchases.paymentListSchema.parse(args)) };
					break;
				case "company_tool:get_company":
					stepResults[step.id] = { success: true, data: await company.getCompany(state.user.companyId) };
					break;
				case "company_tool:list_company_users": {
					const parsed = company.paginationSchema.parse(args);
					stepResults[step.id] = { success: true, data: await company.getUsers(state.user.companyId, parsed.page, parsed.limit) };
					break;
				}
				case "company_tool:list_available_accesses":
					stepResults[step.id] = { success: true, data: company.getAccesses() };
					break;
				default:
					stepResults[step.id] = safeFailure("That operation is not available yet.");
			}
			tracker?.log({ layer: "langgraph", module: "executor.ts", operation: "tool end", toolCallId: step.id });
			tracker?.log({ layer: "langgraph", module: "executor.ts", operation: "tool result", toolCallId: step.id });
		} catch {
			stepResults[step.id] = safeFailure("The requested business operation could not be completed.");
			tracker?.log({ layer: "langgraph", module: "executor.ts", operation: "tool end (failed)", toolCallId: step.id });
		}
	}
	return { stepResults };
};
