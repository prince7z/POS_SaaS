import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../lib/prisma";
import { takealotApi } from "../takealot/takealot-api";
import { AppError, validationError } from "../../utils/errors";

const integrationIdSchema = z.string().uuid();
const credentialsRecord = (value: Prisma.JsonValue): Record<string, Prisma.JsonValue> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Prisma.JsonValue>
    : {};
const configurationRecord = credentialsRecord;

export const createIntegrationSchema = z.object({
  type: z.literal("TAKEALOT"),
  name: z.string().trim().min(1).max(100).default("Takealot"),
  apiKey: z.string().trim().min(1).max(500),
  sellerId: z.string().trim().max(150).optional(),
  lowStockThreshold: z.number().int().min(1).max(100_000).default(5),
}).strict();

export const updateIntegrationSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  apiKey: z.string().trim().min(1).max(500).optional(),
  removeApiKey: z.boolean().optional(),
  sellerId: z.string().trim().max(150).nullable().optional(),
  lowStockThreshold: z.number().int().min(1).max(100_000).optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => !(value.apiKey && value.removeApiKey), {
  message: "Provide a new API key or remove the existing key, not both",
});

export const parse = <T>(schema: z.ZodType<T>, input: unknown): T => {
  const result = schema.safeParse(input);
  if (!result.success) throw validationError(result.error.issues[0]?.message ?? "Invalid request");
  return result.data;
};

export const parseIntegrationId = (value: unknown): string => {
  const result = integrationIdSchema.safeParse(value);
  if (!result.success) throw validationError("Invalid integration id");
  return result.data;
};

const publicIntegration = (integration: {
  id: string;
  type: string;
  name: string;
  credentials: Prisma.JsonValue;
  configuration: Prisma.JsonValue;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => {
  const credentials = credentialsRecord(integration.credentials);
  const configuration = configurationRecord(integration.configuration);
  return {
    id: integration.id,
    type: integration.type,
    name: integration.name,
    configured: typeof credentials.apiKey === "string" && credentials.apiKey.length > 0,
    sellerId: typeof configuration.sellerId === "string" ? configuration.sellerId : null,
    lowStockThreshold: typeof configuration.lowStockThreshold === "number" ? configuration.lowStockThreshold : 5,
    isActive: integration.isActive,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
};

export const listIntegrations = async (companyId: string) => {
  const integrations = await prisma.integration.findMany({
    where: { companyId },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }],
  });
  return integrations.map(publicIntegration);
};

export const createIntegration = async (companyId: string, input: z.infer<typeof createIntegrationSchema>) => {
  const integration = await prisma.integration.create({
    data: {
      companyId,
      type: input.type,
      name: input.name,
      credentials: { apiKey: input.apiKey },
      configuration: {
        ...(input.sellerId && { sellerId: input.sellerId }),
        lowStockThreshold: input.lowStockThreshold,
      },
    },
  });
  return publicIntegration(integration);
};

const findOwnedIntegration = async (companyId: string, integrationId: string) => {
  const integration = await prisma.integration.findFirst({ where: { id: integrationId, companyId } });
  if (!integration) throw new AppError("Integration not found", 404, "INTEGRATION_NOT_FOUND");
  return integration;
};

export const getIntegration = async (companyId: string, integrationId: string) =>
  publicIntegration(await findOwnedIntegration(companyId, integrationId));

export const assertTakealotIntegration = async (companyId: string, integrationId: string) => {
  const integration = await findOwnedIntegration(companyId, integrationId);
  if (integration.type !== "TAKEALOT") {
    throw new AppError("This integration is not a Takealot connection.", 422, "INTEGRATION_TYPE_MISMATCH");
  }
  if (!integration.isActive) {
    throw new AppError("This Takealot integration is disabled.", 422, "INTEGRATION_DISABLED");
  }
};

export const getDefaultTakealotIntegrationId = async (companyId: string) => {
  const integrations = await prisma.integration.findMany({
    where: { companyId, type: "TAKEALOT", isActive: true },
    select: { id: true },
    take: 2,
  });
  if (integrations.length === 0) {
    throw new AppError("No active Takealot integration is configured.", 422, "TAKEALOT_API_NOT_CONFIGURED");
  }
  if (integrations.length > 1) {
    throw new AppError(
      "More than one Takealot integration is configured. Select an integration before requesting Takealot data.",
      409,
      "TAKEALOT_INTEGRATION_SELECTION_REQUIRED",
    );
  }
  return integrations[0].id;
};

export const getTakealotLowStockThreshold = async (integrationId: string) => {
  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, type: "TAKEALOT" },
    select: { configuration: true },
  });
  if (!integration) throw new AppError("Takealot integration not found", 404, "INTEGRATION_NOT_FOUND");
  const threshold = configurationRecord(integration.configuration).lowStockThreshold;
  return typeof threshold === "number" && Number.isInteger(threshold) && threshold > 0 ? threshold : 5;
};

export const getTakealotApiKey = async (
  companyId: string,
  integrationId?: string,
  options: { includeInactive?: boolean } = {},
): Promise<string> => {
  const resolvedIntegrationId = integrationId ?? await getDefaultTakealotIntegrationId(companyId);
  const integration = await findOwnedIntegration(companyId, resolvedIntegrationId);
  if (integration.type !== "TAKEALOT") {
    throw new AppError("This integration is not a Takealot connection.", 422, "INTEGRATION_TYPE_MISMATCH");
  }
  if (!integration.isActive && !options.includeInactive) {
    throw new AppError("This Takealot integration is disabled.", 422, "INTEGRATION_DISABLED");
  }
  const apiKey = credentialsRecord(integration.credentials).apiKey;
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new AppError("Takealot API key is not configured for this integration.", 422, "TAKEALOT_API_NOT_CONFIGURED");
  }
  return apiKey;
};

export const updateIntegration = async (
  companyId: string,
  integrationId: string,
  input: z.infer<typeof updateIntegrationSchema>,
) => {
  const integration = await findOwnedIntegration(companyId, integrationId);
  if (integration.type !== "TAKEALOT") {
    throw new AppError("This integration type cannot be edited yet.", 422, "INTEGRATION_TYPE_UNSUPPORTED");
  }
  const credentials = credentialsRecord(integration.credentials);
  const configuration = configurationRecord(integration.configuration);
  if (input.apiKey) credentials.apiKey = input.apiKey;
  if (input.removeApiKey) delete credentials.apiKey;
  if (input.sellerId !== undefined) {
    if (input.sellerId === null || input.sellerId === "") delete configuration.sellerId;
    else configuration.sellerId = input.sellerId;
  }
  if (input.lowStockThreshold !== undefined) configuration.lowStockThreshold = input.lowStockThreshold;
  const updated = await prisma.integration.update({
    where: { id: integrationId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      credentials: credentials as Prisma.InputJsonObject,
      configuration: configuration as Prisma.InputJsonObject,
    },
  });
  return publicIntegration(updated);
};

export const deleteIntegration = async (companyId: string, integrationId: string) => {
  await findOwnedIntegration(companyId, integrationId);
  await prisma.integration.delete({ where: { id: integrationId } });
};

export const testTakealotIntegration = async (companyId: string, integrationId: string) => {
  const apiKey = await getTakealotApiKey(companyId, integrationId, { includeInactive: true });
  await takealotApi.getSalesSummary(apiKey);
  return { connected: true };
};
