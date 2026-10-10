import { logger } from "../../lib/logger";
import { AppError } from "../../utils/errors";

type StockSyncInput = {
	companyId: string;
	productId: string;
	takealotProductId: string;
	quantity: number;
};

export type OfferIdentifierType = "BARCODE" | "SKU" | "OFFER_ID";

export const takealotClient = {
	async findOffer(apiKey: string, identifierType: OfferIdentifierType, identifier: string): Promise<unknown> {
		const encodedIdentifier = encodeURIComponent(identifier);
		const path = identifierType === "OFFER_ID"
			? encodedIdentifier
			: `${identifierType}${encodedIdentifier}`;
		const response = await fetch(`https://seller-api.takealot.com/v2/offers/offer/${path}`, {
			method: "GET",
			headers: { Authorization: `Key ${apiKey}`, Accept: "application/json" },
			signal: AbortSignal.timeout(10_000),
		});

		if (response.status === 404) return null;
		if (!response.ok) {
			throw new AppError(`Takealot offer lookup failed with status ${response.status}.`, 502, "TAKEALOT_LOOKUP_FAILED");
		}
		try {
			return await response.json();
		} catch {
			throw new AppError("Takealot returned an invalid offer response.", 502, "TAKEALOT_INVALID_RESPONSE");
		}
	},
};

export const queueTakealotStockSync = async (input: StockSyncInput): Promise<void> => {
	logger.info("Takealot stock sync queued", {
		companyId: input.companyId,
		productId: input.productId,
		takealotProductId: input.takealotProductId,
		quantity: input.quantity,
	});
};