import type { Company, CompanyUser, User } from "@prisma/client";
import { toPublicMediaUrl } from "../integrations/aws/media";

export type SanitizableUser = Partial<User> & {
	id: string;
	fullName: string;
	email: string;
	phone?: string | null;
	profileImageKey?: string | null;
	createdAt?: Date;
	companyId?: string;
	roleName?: string;
	accesses?: any[];
	isActive?: boolean;
	companyUser?: Partial<CompanyUser> | null;
};

export const sanitizeUser = (
	user: SanitizableUser,
	membership?: Partial<CompanyUser> | null,
) => {
	const m = membership ?? user.companyUser ?? user;
	return {
		id: user.id,
		companyId: m.companyId ?? "",
		fullName: user.fullName,
		email: user.email,
		phone: user.phone ?? null,
		profileImageKey: user.profileImageKey ?? null,
		profileImageUrl: user.profileImageKey ? toPublicMediaUrl(user.profileImageKey) : null,
		roleName: m.roleName ?? "Staff",
		accesses: m.accesses ?? [],
		isActive: m.isActive ?? true,
		createdAt: user.createdAt ?? new Date(),
	};
};

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
	invoiceTerms: company.invoiceTerms,
	businessHours: company.businessHours,
	takealotSellerId: company.takealotSellerId,
	takealotConfigured: Boolean(company.takealotApiKey),
	createdAt: company.createdAt,
	updatedAt: company.updatedAt,
});