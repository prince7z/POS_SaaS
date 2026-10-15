import { getTakealotApiKey } from "../../../middleware/takealot";
import * as takealot from "../../takealot/service";

export const executeTakealotTool = async (
	companyId: string,
	operation: string,
	args: Record<string, unknown>,
): Promise<unknown> => {
	switch (operation) {
		case "sales_summary": {
			const input = takealot.parse(takealot.salesSummarySchema, args);
			const apiKey = await getTakealotApiKey(companyId);
			return takealot.salesSummary(companyId, apiKey, input);
		}
		case "sales_trends": {
			const input = takealot.parse(takealot.trendsSchema, args);
			const apiKey = await getTakealotApiKey(companyId);
			return takealot.salesTrends(companyId, apiKey, input);
		}
		case "sales_breakdown": {
			const input = takealot.parse(takealot.breakdownSchema, args);
			const apiKey = await getTakealotApiKey(companyId);
			return takealot.salesBreakdown(companyId, apiKey, input);
		}
		case "product_performance": {
			const input = takealot.parse(takealot.productsSchema, args);
			const apiKey = await getTakealotApiKey(companyId);
			return takealot.productPerformance(companyId, apiKey, input);
		}
		case "list_sales": {
			const input = takealot.parse(takealot.salesListSchema, args);
			const apiKey = await getTakealotApiKey(companyId);
			return takealot.listSales(apiKey, input);
		}
		case "list_orders": {
			const input = takealot.parse(takealot.ordersSchema, args);
			const apiKey = await getTakealotApiKey(companyId);
			return takealot.listOrders(apiKey, input);
		}
		case "overview": {
			const input = takealot.parse(takealot.overviewSchema, args);
			const apiKey = await getTakealotApiKey(companyId);
			return takealot.overview(apiKey, input);
		}
		case "inventory_summary": {
			const apiKey = await getTakealotApiKey(companyId);
			return takealot.inventorySummary(companyId, apiKey);
		}
		case "inventory_snapshots": {
			const input = takealot.parse(takealot.inventorySnapshotsSchema, args);
			return takealot.inventorySnapshots(companyId, input);
		}
		default:
			throw new Error(`Unsupported Takealot operation: ${operation}`);
	}
};
