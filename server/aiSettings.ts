import type { Request } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { pool as mainPool } from "./db";

export type AiFeature = "plans" | "chat" | "foodSearch";

export interface AiFeatureSettings {
  apiKey?: string;
  model?: string;
  assistantId?: string;
  assistantUrl?: string;
  promptId?: string;
  promptVersion?: string;
}

export interface AiSettings {
  plans?: AiFeatureSettings;
  chat?: AiFeatureSettings;
  foodSearch?: AiFeatureSettings;
}

export const AI_NOT_CONFIGURED_CODE = "AI_NOT_CONFIGURED" as const;

const aiPlansSchema = z.object({
  apiKey: z.string().optional(),
  model: z.string().optional(),
  assistantId: z.string().optional(),
  assistantUrl: z.string().optional(),
}).partial();

const aiChatSchema = z.object({
  apiKey: z.string().optional(),
  model: z.string().optional(),
}).partial();

const aiFoodSearchSchema = z.object({
  apiKey: z.string().optional(),
  model: z.string().optional(),
  promptId: z.string().optional(),
  promptVersion: z.string().optional(),
}).partial();

export const aiSettingsInputSchema = z.object({
  plans: aiPlansSchema.optional(),
  chat: aiChatSchema.optional(),
  foodSearch: aiFoodSearchSchema.optional(),
}).partial();


const normalizeString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const sanitizeFeatureSettings = (input?: AiFeatureSettings): AiFeatureSettings | undefined => {
  if (!input) return undefined;
  const sanitized: AiFeatureSettings = {
    apiKey: normalizeString(input.apiKey),
    model: normalizeString(input.model),
    assistantId: normalizeString(input.assistantId),
    assistantUrl: normalizeString(input.assistantUrl),
    promptId: normalizeString(input.promptId),
    promptVersion: normalizeString(input.promptVersion),
  };

  const hasValues = Object.values(sanitized).some((value) => value !== undefined);
  return hasValues ? sanitized : undefined;
};

export const sanitizeAiSettings = (input: AiSettings): AiSettings => {
  const plans = sanitizeFeatureSettings(input.plans);
  const chat = sanitizeFeatureSettings(input.chat);
  const foodSearch = sanitizeFeatureSettings(input.foodSearch);

  return {
    ...(plans ? { plans } : {}),
    ...(chat ? { chat } : {}),
    ...(foodSearch ? { foodSearch } : {}),
  };
};

const normalizeJsonValue = (value: unknown): Record<string, any> => {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, any>;
    } catch {
      return {};
    }
  }
  if (typeof value === "object") return value as Record<string, any>;
  return {};
};

const ensurePlatformSettingsRow = async (): Promise<{ id: boolean; ai_settings: any }> => {
  await mainPool.query(`
    CREATE TABLE IF NOT EXISTS platform_ai_settings (
      id BOOLEAN PRIMARY KEY DEFAULT TRUE,
      ai_settings JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await mainPool.query(
    "INSERT INTO platform_ai_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING"
  );

  const existing = await mainPool.query(
    "SELECT id, ai_settings FROM platform_ai_settings WHERE id = TRUE LIMIT 1"
  );
  return existing.rows[0];
};

const ensureTenantSettingsRow = async (tenantPool: Pool): Promise<{ id: number; custom_settings: any }> => {
  const existing = await tenantPool.query(
    "SELECT id, custom_settings FROM tenant_settings ORDER BY id ASC LIMIT 1"
  );
  if (existing.rows[0]) return existing.rows[0];

  const created = await tenantPool.query(
    "INSERT INTO tenant_settings DEFAULT VALUES RETURNING id, custom_settings"
  );
  return created.rows[0];
};

export const getAiSettingsForRequest = async (req: Request): Promise<AiSettings> => {
  const tenantPool = (req as any).tenantPool as Pool | undefined;
  if (tenantPool) {
    const row = await ensureTenantSettingsRow(tenantPool);
    const customSettings = normalizeJsonValue(row.custom_settings);
    return (customSettings.ai ?? {}) as AiSettings;
  }

  const row = await ensurePlatformSettingsRow();
  const settings = normalizeJsonValue(row.ai_settings);
  return settings as AiSettings;
};

export const saveAiSettingsForRequest = async (req: Request, input: AiSettings): Promise<AiSettings> => {
  const sanitized = sanitizeAiSettings(input);
  const tenantPool = (req as any).tenantPool as Pool | undefined;

  if (tenantPool) {
    const row = await ensureTenantSettingsRow(tenantPool);
    const customSettings = normalizeJsonValue(row.custom_settings);
    const nextCustomSettings = { ...customSettings, ai: sanitized };
    await tenantPool.query(
      "UPDATE tenant_settings SET custom_settings = $1, updated_at = NOW() WHERE id = $2",
      [nextCustomSettings, row.id]
    );
    return sanitized;
  }

  const row = await ensurePlatformSettingsRow();
  await mainPool.query(
    "UPDATE platform_ai_settings SET ai_settings = $1, updated_at = NOW() WHERE id = TRUE",
    [sanitized]
  );
  return sanitized;
};

export const getAiSettingsConfiguredFlags = (settings: AiSettings) => ({
  plans: Boolean(settings.plans?.apiKey),
  chat: Boolean(settings.chat?.apiKey),
  foodSearch: Boolean(settings.foodSearch?.apiKey),
});

export const getAiFeatureConfig = (
  settings: AiSettings,
  feature: AiFeature
): AiFeatureSettings | null => {
  const config = settings[feature];
  if (!config?.apiKey) return null;
  return config;
};

export const buildAiNotConfiguredResponse = (feature: AiFeature) => {
  const featureLabels: Record<AiFeature, string> = {
    plans: "plan generation",
    chat: "AI chat",
    foodSearch: "AI food search",
  };
  return {
    code: AI_NOT_CONFIGURED_CODE,
    feature,
    message: `AI is not configured for ${featureLabels[feature]}. Ask your admin to set AI settings.`,
  };
};
