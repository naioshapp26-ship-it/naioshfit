import type { Request } from 'express';

const MAX_METADATA_KEY_LENGTH = 40;
const MAX_METADATA_VALUE_LENGTH = 500;

function truncateValue(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function normalizeMetadataKey(key: string): string | null {
  const trimmed = key.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '_');
  return normalized.slice(0, MAX_METADATA_KEY_LENGTH) || null;
}

function stringifyMetadataValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  try {
    const json = JSON.stringify(value);
    return json ?? null;
  } catch (error) {
    return String(value);
  }
}

export function buildStripeMetadata(input: Record<string, unknown>): Record<string, string> {
  const output: Record<string, string> = {};

  Object.entries(input || {}).forEach(([key, value]) => {
    const normalizedKey = normalizeMetadataKey(key);
    if (!normalizedKey) {
      return;
    }

    const stringValue = stringifyMetadataValue(value);
    if (stringValue === null) {
      return;
    }

    const trimmedValue = stringValue.trim();
    if (!trimmedValue) {
      return;
    }

    output[normalizedKey] = truncateValue(trimmedValue, MAX_METADATA_VALUE_LENGTH);
  });

  return output;
}

export function mergeStripeMetadata(...inputs: Array<Record<string, unknown> | undefined>): Record<string, string> {
  const merged: Record<string, unknown> = {};

  inputs.forEach((input) => {
    if (!input) {
      return;
    }
    Object.assign(merged, input);
  });

  return buildStripeMetadata(merged);
}

export function buildRequestMetadata(req: Request): Record<string, unknown> {
  const forwardedFor = req.headers['x-forwarded-for'];
  const requestIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor || req.ip;

  return {
    request_host: req.headers.host,
    request_origin: req.headers.origin,
    request_referer: req.headers.referer,
    request_ip: requestIp,
    request_user_agent: req.headers['user-agent'],
    request_path: req.originalUrl || req.path,
    request_method: req.method,
  };
}
