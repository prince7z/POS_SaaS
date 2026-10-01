import { logger } from "../../lib/logger";

type StockSyncInput = {
	companyId: string;
	productId: string;
	takealotProductId: string;
	quantity: number;
};

export const takealotClient = {};

export const queueTakealotStockSync = async (input: StockSyncInput): Promise<void> => {
	logger.info("Takealot stock sync queued", {
		companyId: input.companyId,
		productId: input.productId,
		takealotProductId: input.takealotProductId,
		quantity: input.quantity,
	});
};