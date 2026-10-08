import * as customers from "../../customers/service";
import * as reports from "../../reports/service";
import * as sales from "../../sales/service";
import * as inventory from "../../inventory/service";
import * as expenses from "../../expenses/service";
import * as catalog from "../../catalog/service";
import * as purchases from "../../purchases/service";
import * as company from "../../company/service";
import { queueCustomEmail } from "../../notification/notification.service";
import { logger } from "../../../lib/logger";
import { findAgentTool } from "../registry";
import type { AgentGraphState } from "./state";
import { interrupt, isGraphInterrupt } from "@langchain/langgraph";

const safeFailure = (safeMessage: string) => ({
	success: false as const,
	errorCode: "AGENT_OPERATION_UNAVAILABLE",
	safeMessage,
	retryable: false,
});

const isConfirmationApproved = (res: unknown): boolean => {
	if (res === true || res === "true" || res === "confirm" || res === "yes" || res === "proceed" || res === "approve") {
		return true;
	}
	if (typeof res === "object" && res !== null) {
		const val =
			(res as { selectedOption?: unknown; value?: unknown; id?: unknown }).selectedOption ??
			(res as { selectedOption?: unknown; value?: unknown; id?: unknown }).value ??
			(res as { selectedOption?: unknown; value?: unknown; id?: unknown }).id;
		if (val === true || val === "true" || val === "confirm" || val === "yes" || val === "proceed" || val === "approve") {
			return true;
		}
	}
	return false;
};

import { estimateTokens, type AgentPerfTracker } from "../utils/perfLogger";

import { createOpenRouterClient } from "../client/openRouterClient";
import { emailSystemPrompt } from "../prompts/email";
import type { AgentUser } from "../schemas";

type CachedEmailDraft = {
	draftId: string;
	to: string[];
	subject: string;
	html: string;
	createdAt: number;
};

const emailDraftCache = new Map<string, CachedEmailDraft>();

function cleanExpiredDrafts() {
	const now = Date.now();
	for (const [key, draft] of emailDraftCache.entries()) {
		if (now - draft.createdAt > 3600_000) {
			emailDraftCache.delete(key);
		}
	}
}

function sanitizeEmailImages(html: string, user: { companyName?: string; companyLogoUrl?: string | null }): string {
	const companyBrandHeader = `<div style="font-size:22px; font-weight:700; color:#0f172a; margin-bottom:20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; letter-spacing:-0.5px;">${user.companyName || "POS SaaS"}</div>`;

	return html.replace(/<img[^>]*src=["']([^"']+)["'][^>]*\/?>/gi, (imgTag, srcUrl) => {
		const srcLower = srcUrl.toLowerCase();
		if (srcLower.includes(".avif") || srcLower.includes(".webp") || srcLower.includes("salesakart.com")) {
			if (user.companyLogoUrl && !user.companyLogoUrl.toLowerCase().includes(".avif")) {
				return imgTag.replace(srcUrl, user.companyLogoUrl);
			}
			return companyBrandHeader;
		}
		if (user.companyLogoUrl) {
			return imgTag.replace(srcUrl, user.companyLogoUrl);
		}
		return imgTag;
	});
}

async function generateEmailHtml(params: {
	request: string;
	user: AgentUser;
	to: string[];
	subject: string;
	stepResults: Record<string, unknown>;
	initialHtml?: string;
	tracker?: AgentPerfTracker;
}): Promise<string> {
	const messages = [
		{ role: "system" as const, content: emailSystemPrompt },
		{
			role: "user" as const,
			content: JSON.stringify({
				userRequest: params.request,
				recipient: params.to,
				subject: params.subject,
				userContext: {
					userName: params.user.userName || "Store Manager",
					companyName: params.user.companyName || "POS SaaS",
					companyLogoUrl: params.user.companyLogoUrl || null,
				},
				stepResults: params.stepResults,
				additionalInstructions:
					params.initialHtml && !params.initialHtml.includes("<div id=")
						? params.initialHtml
						: undefined,
			}),
		},
	];

	const raw = await createOpenRouterClient().invoke(
		messages,
		params.tracker,
		undefined,
		{
			nodeName: "email_generator",
			state: {
				request: params.request,
				to: params.to,
				subject: params.subject,
				stepResultsKeys: Object.keys(params.stepResults),
				user: { id: params.user.id, companyId: params.user.companyId },
			},
		}
	);

	const stripped = raw.replace(/^\`\`\`(?:html)?\s*/i, "").replace(/\s*\`\`\`$/i, "").trim();
	return sanitizeEmailImages(stripped, params.user);
}

export const executePlan = async (state: AgentGraphState, tracker?: AgentPerfTracker) => {
	const plan = state.plan;
	if (!plan) return { stepResults: {} };
	const stepResults: Record<string, unknown> = { ...(state.stepResults || {}) };

	for (const step of plan.steps) {
		if (step.type === "human_input") {
			tracker?.log({
				layer: "langgraph",
				module: "executor.ts",
				operation: "human_input interrupt",
				todoId: step.id,
			});
			const req = (step.request && typeof step.request === "object" ? step.request : {}) as {
				question?: string;
				options?: Array<{ id?: string; label?: string; value?: string } | string>;
				allowOther?: boolean;
			};
			const questionId = `q_${Date.now()}_${step.id}`;
			const stepDesc = "description" in step ? (step as { description?: string }).description : undefined;
			const questionText = req.question || stepDesc || "Please select an option to proceed:";
			const options = Array.isArray(req.options)
				? req.options.map((opt, idx) => {
						if (typeof opt === "string") {
							return { id: `opt_${idx}`, label: opt, value: opt };
						}
						return {
							id: String(opt.id || `opt_${idx}`),
							label: String(opt.label || opt.value || `Option ${idx + 1}`),
							value: String(opt.value || opt.label || `Option ${idx + 1}`),
						};
				  })
				: undefined;

			const userResponse = interrupt({
				questionId,
				message: questionText,
				options,
				allowTextInput: req.allowOther ?? true,
			});

			stepResults[step.id] = { success: true, userResponse };
			continue;
		}

		if (step.type !== "tool") continue;
		if (step.requiresConfirmation && step.tool !== "email_tool") {
			const response = interrupt({
				type: "confirmation",
				question: `Continue with: ${step.description}?`,
				options: [
					{ id: "confirm", label: "Continue" },
					{ id: "cancel", label: "Cancel" },
				],
			});
			if (!isConfirmationApproved(response)) {
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
			const toolStartTime = performance.now();
			tracker?.logToolStart({
				toolCallId: step.id,
				toolName: `${step.tool}:${step.operation}`,
			});
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
				case "email_tool:send_custom_email": {
					cleanExpiredDrafts();
					const draftKey = `${state.user.id}_${state.user.companyId}_${step.id}`;
					const toRaw = args.to || args.recipient || args.recipients;
					const to = Array.isArray(toRaw) ? toRaw.map(String) : [String(toRaw || "")];
					const subject = String(args.subject || "No Subject");
					const rawHtml = String(args.html || args.body || "");

					let draft = emailDraftCache.get(draftKey);
					if (!draft) {
						tracker?.log({
							layer: "langgraph",
							module: "executor.ts",
							operation: "email html reasoning & generation start",
							todoId: step.id,
						});

						const generatedHtml = await generateEmailHtml({
							request: state.request,
							user: state.user,
							to,
							subject,
							stepResults,
							initialHtml: rawHtml,
							tracker,
						});

						tracker?.log({
							layer: "langgraph",
							module: "executor.ts",
							operation: "email html reasoning & generation complete",
							todoId: step.id,
						});

						const draftId = `email_draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
						draft = {
							draftId,
							to,
							subject,
							html: generatedHtml,
							createdAt: Date.now(),
						};
						emailDraftCache.set(draftKey, draft);
					}

					const approvalResponse = interrupt({
						type: "email_approval",
						draftId: draft.draftId,
						to: draft.to,
						subject: draft.subject,
						html: draft.html,
					});

					let action: string | undefined = undefined;
					let feedback: string | undefined = undefined;
					if (typeof approvalResponse === "string") {
						action = approvalResponse;
					} else if (typeof approvalResponse === "object" && approvalResponse !== null) {
						const obj = approvalResponse as Record<string, unknown>;
						action = String(obj.action || obj.value || obj.id || "");
						feedback = typeof obj.feedback === "string" ? obj.feedback : undefined;
					}

					if (action === "approve" || action === "confirm" || action === "yes") {
						await queueCustomEmail({
							companyId: state.user.companyId,
							to: draft.to,
							subject: draft.subject,
							html: draft.html,
							triggeredBy: "agent_email_tool",
						});
						emailDraftCache.delete(draftKey);
						stepResults[step.id] = {
							success: true,
							status: "queued",
							message: "Email queued successfully.",
							summary: "Email queued successfully.",
						};
					} else if (action === "reject" || action === "cancel" || action === "no") {
						emailDraftCache.delete(draftKey);
						stepResults[step.id] = {
							success: false,
							errorCode: "EMAIL_REJECTED",
							safeMessage: "Email draft was rejected by user.",
							summary: "Email draft was rejected by user.",
						};
					} else if (action === "change") {
						emailDraftCache.delete(draftKey);
						stepResults[step.id] = {
							success: false,
							errorCode: "EMAIL_CHANGES_REQUESTED",
							feedback,
							safeMessage: `User requested changes to email draft: ${feedback}`,
							summary: `User requested changes to email draft: ${feedback}`,
						};
					} else {
						stepResults[step.id] = {
							success: false,
							errorCode: "EMAIL_APPROVAL_REQUIRED",
							safeMessage: "Email requires explicit user approval before enqueuing.",
							summary: "Email requires explicit user approval before enqueuing.",
						};
					}
					break;
				}
				default:
					stepResults[step.id] = safeFailure("That operation is not available yet.");
			}
			const toolDurationMs = Math.round((performance.now() - toolStartTime) * 100) / 100;
			const resStr = JSON.stringify(stepResults[step.id] ?? "");
			tracker?.logToolEnd({
				toolCallId: step.id,
				toolName: `${step.tool}:${step.operation}`,
				durationMs: toolDurationMs,
				resultCharCount: resStr.length,
				resultEstTokens: estimateTokens(resStr),
			});
			tracker?.log({ layer: "langgraph", module: "executor.ts", operation: "tool end", toolCallId: step.id });
			tracker?.log({ layer: "langgraph", module: "executor.ts", operation: "tool result", toolCallId: step.id });
		} catch (err) {
			if (isGraphInterrupt(err)) {
				throw err;
			}
			logger.error("Agent tool execution failed", { stepId: step.id, tool: step.tool, operation: step.operation, error: err });
			stepResults[step.id] = safeFailure("The requested business operation could not be completed.");
			tracker?.log({ layer: "langgraph", module: "executor.ts", operation: "tool end (failed)", toolCallId: step.id });
		}
	}
	return { stepResults };
};
