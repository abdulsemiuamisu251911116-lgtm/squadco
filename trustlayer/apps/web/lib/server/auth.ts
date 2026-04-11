import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

import { prisma, withPrismaReconnectRetry } from "./prisma";
import { supabaseAdmin } from "./supabase-admin";
import { incrementWindow } from "./upstash";
import { captureMessage } from "./monitoring";

const WINDOW_MS = 60_000;
const LIMIT = 100;
const keyBuckets = new Map<string, { count: number; resetAt: number }>();
const orgBuckets = new Map<string, { count: number; resetAt: number }>();

export type InternalAuth = {
  sub: string;
  org_id?: string;
  role?: string;
  email?: string;
};

export type ApiKeyAuth = {
  id: string;
  orgId: string;
  environment: "sandbox" | "production";
  prefix: string;
};

async function withinKeyLimit(id: string) {
  try {
    const redisCount = await incrementWindow(`ratelimit:key:${id}`, WINDOW_MS / 1000);
    if (redisCount) return redisCount <= LIMIT;
  } catch {
    await captureMessage("Upstash key rate limit fallback engaged", "warning", { keyId: id });
  }
  const now = Date.now();
  const bucket = keyBuckets.get(id);
  if (!bucket || bucket.resetAt < now) {
    keyBuckets.set(id, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= LIMIT) return false;
  bucket.count += 1;
  return true;
}

async function withinOrgLimit(orgId: string) {
  try {
    const redisCount = await incrementWindow(`ratelimit:org:${orgId}`, WINDOW_MS / 1000);
    if (redisCount) return redisCount <= 1000;
  } catch {
    await captureMessage("Upstash org rate limit fallback engaged", "warning", { orgId });
  }
  const now = Date.now();
  const bucket = orgBuckets.get(orgId);
  if (!bucket || bucket.resetAt < now) {
    orgBuckets.set(orgId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= 1000) return false;
  bucket.count += 1;
  return true;
}

export async function getInternalAuth(request: NextRequest): Promise<InternalAuth | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  const profile = await supabaseAdmin.from("users").select("id, org_id, role, email").eq("id", data.user.id).maybeSingle();
  if (!profile.data) return null;
  return {
    sub: profile.data.id,
    org_id: profile.data.org_id || undefined,
    role: profile.data.role,
    email: profile.data.email
  };
}

export async function getApiKeyAuth(request: NextRequest): Promise<{ auth: ApiKeyAuth | null; reason?: "missing" | "invalid" | "rate_limit" | "org_limit" | "monthly_limit"; limit?: number; used?: number }> {
  const rawKey = request.headers.get("x-trustlayer-key");
  if (!rawKey) return { auth: null, reason: "missing" };

  const candidates = await withPrismaReconnectRetry(() =>
    prisma.apiKey.findMany({
      where: {
        isActive: true,
        keyPrefix: { startsWith: rawKey.slice(0, 12) }
      }
    })
  );

  for (const candidate of candidates) {
    if (!(await bcrypt.compare(rawKey, candidate.keyHash))) continue;
    if (!(await withinKeyLimit(candidate.id))) return { auth: null, reason: "rate_limit" };

    const org = await withPrismaReconnectRetry(() =>
      prisma.organization.findUnique({ where: { id: candidate.orgId } })
    );
    if (!org) return { auth: null, reason: "invalid" };
    if (candidate.environment === "production" && org.apiCallCount >= org.monthlyLimit) {
      return { auth: null, reason: "monthly_limit", limit: org.monthlyLimit, used: org.apiCallCount };
    }
    if (!(await withinOrgLimit(candidate.orgId))) return { auth: null, reason: "org_limit" };

    await withPrismaReconnectRetry(() =>
      prisma.apiKey.update({ where: { id: candidate.id }, data: { lastUsedAt: new Date() } })
    );
    await withPrismaReconnectRetry(() =>
      prisma.organization.update({ where: { id: candidate.orgId }, data: { apiCallCount: { increment: 1 } } })
    );

    return {
      auth: {
        id: candidate.id,
        orgId: candidate.orgId,
        environment: candidate.environment as "sandbox" | "production",
        prefix: candidate.keyPrefix
      }
    };
  }
  return { auth: null, reason: "invalid" };
}

export async function logExternalCall(apiKey: ApiKeyAuth, requestId: string, method: string, resource: string, statusCode: number) {
  void prisma.auditLog.create({
    data: {
      orgId: apiKey.orgId,
      action: `external.${method.toLowerCase()}`,
      resource,
      metadata: {
        request_id: requestId,
        status_code: statusCode,
        api_key_id: apiKey.id
      }
    }
  });
}
