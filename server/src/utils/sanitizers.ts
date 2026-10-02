import type { Company, User } from "@prisma/client";
import { toPublicMediaUrl } from "../integrations/aws/media";

export const sanitizeUser = (user: User) => ({
	id: user.id,
	companyId: user.companyId,
	fullName: user.fullName,
	email: user.email,
	phone: user.phone,
	roleName: user.roleName,
	accesses: user.accesses,
	isActive: user.isActive,
	createdAt: user.createdAt,
});

export const sanitizeCompany = (company: Company) => ({
	id: company.id,
	name: company.name,
	phone: company.phone,
	email: company.email,
	logoKey: company.logoKey,
	logoUrl: company.logoKey ? toPublicMediaUrl(company.logoKey) : null,
	addressLine1: company.addressLine1,
	addressLine2: company.addressLine2,
	city: company.city,
	state: company.state,
	postalCode: company.postalCode,
	countryCode: company.countryCode,
	currencyCode: company.currencyCode,
	timezone: company.timezone,
	defaultTaxRate: Number(company.defaultTaxRate),
	dateFormat: company.dateFormat,
	timeFormat: company.timeFormat,
	lowStockAlerts: company.lowStockAlerts,
	showProductImages: company.showProductImages,
	autoGenerateInvoiceNumber: company.autoGenerateInvoiceNumber,
	autoPrintInvoice: company.autoPrintInvoice,
	takealotSellerId: company.takealotSellerId,
	takealotConfigured: Boolean(company.takealotApiKey),
	createdAt: company.createdAt,
	updatedAt: company.updatedAt,
});