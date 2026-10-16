import { assertTakealotIntegration, getDefaultTakealotIntegrationId, getTakealotApiKey } from "../../integrations/service";
import * as takealot from "../../takealot/service";

export const executeTakealotTool = async (
	companyId: string,
	operation: string,
	args: Record<string, unknown>,
): Promise<unknown> => {
	const integrationId = typeof args.integrationId === "string" ? args.integrationId : undefined;
	const toolArgs = Object.fromEntries(Object.entries(args).filter(([key]) => key !== "integrationId"));
	const getApiKey = () => getTakealotApiKey(companyId, integrationId);
	switch (operation) {
		case "sales_summary": {
			const input = takealot.parse(takealot.salesSummarySchema, toolArgs);
			const apiKey = await getApiKey();
			return takealot.salesSummary(companyId, apiKey, input);
		}
		case "sales_trends": {
			const input = takealot.parse(takealot.trendsSchema, toolArgs);
			const apiKey = await getApiKey();
			return takealot.salesTrends(companyId, apiKey, input);
		}
		case "sales_breakdown": {
			const input = takealot.parse(takealot.breakdownSchema, toolArgs);
			const apiKey = await getApiKey();
			return takealot.salesBreakdown(companyId, apiKey, input);
		}
		case "product_performance": {
			const input = takealot.parse(takealot.productsSchema, toolArgs);
			const apiKey = await getApiKey();
			return takealot.productPerformance(companyId, apiKey, input);
		}
		case "list_sales": {
			const input = takealot.parse(takealot.salesListSchema, toolArgs);
			const apiKey = await getApiKey();
			return takealot.listSales(apiKey, input);
		}
		case "list_orders": {
			const input = takealot.parse(takealot.ordersSchema, toolArgs);
			const apiKey = await getApiKey();
			return takealot.listOrders(apiKey, input);
		}
		case "overview": {
			const input = takealot.parse(takealot.overviewSchema, toolArgs);
			const apiKey = await getApiKey();
			return takealot.overview(apiKey, input);
		}
		case "inventory_summary": {
			const apiKey = await getApiKey();
			const resolvedIntegrationId = integrationId ?? await getDefaultTakealotIntegrationId(companyId);
			return takealot.inventorySummary(companyId, resolvedIntegrationId, apiKey);
		}
		case "inventory_snapshots": {
			const input = takealot.parse(takealot.inventorySnapshotsSchema, toolArgs);
			const resolvedIntegrationId = integrationId ?? await getDefaultTakealotIntegrationId(companyId);
			await assertTakealotIntegration(companyId, resolvedIntegrationId);
			return takealot.inventorySnapshots(companyId, resolvedIntegrationId, input);
		}
		default:
			throw new Error(`Unsupported Takealot operation: ${operation}`);
	}
};
