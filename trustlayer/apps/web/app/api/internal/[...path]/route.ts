import crypto from "crypto";

import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";

import { getInternalAuth } from "../../../../lib/server/auth";
import { aiEngineService } from "../../../../lib/server/ai-engine";
import { resetMonthlyUsageCounts } from "../../../../lib/server/billing";
import { analyzeCredit } from "../../../../lib/server/external";
import { generateApiKey, hashApiKey } from "../../../../lib/server/hash";
import { completeJob, enqueueJob, failJob } from "../../../../lib/server/job-queue";
import { sendInviteEmail } from "../../../../lib/server/mail";
import { prisma } from "../../../../lib/server/prisma";
import { jsonError, jsonOk } from "../../../../lib/server/response";
import { buildOtpAuthUri, generateTotpSecret, verifyTotp } from "../../../../lib/server/totp";
import { sendWebhook } from "../../../../lib/server/webhook";

function pathKey(params: { path?: string[] }) {
  return (params.path || []).join("/");
}

function hasRole(role: string | undefined, roles: string[]) {
  return !!role && roles.includes(role);
}

async function requireInternal(request: NextRequest, requestId: string) {
  const auth = await getInternalAuth(request);
  if (!auth) return jsonError("invalid token", requestId, 401);
  return auth;
}

export async function GET(request: NextRequest, { params }: { params: { path?: string[] } }) {
  const requestId = crypto.randomUUID();
  const authOrResponse = await requireInternal(request, requestId);
  if (authOrResponse instanceof Response) return authOrResponse;
  const auth = authOrResponse;
  const key = pathKey(params);

  if (key === "api-keys") {
    if (!auth.org_id) return jsonError("missing org", requestId, 400);
    return jsonOk(await prisma.apiKey.findMany({ where: { orgId: auth.org_id }, orderBy: { createdAt: "desc" } }), requestId);
  }

  if (key === "org/stats") {
    if (!auth.org_id) return jsonError("missing org", requestId, 400);
    const [customers, transactionsToday, flagged, trustAgg] = await Promise.all([
      prisma.bankCustomer.count({ where: { orgId: auth.org_id } }),
      prisma.transaction.count({ where: { orgId: auth.org_id, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
      prisma.transaction.count({ where: { orgId: auth.org_id, decision: { in: ["verify", "block"] } } }),
      prisma.bankCustomer.aggregate({ where: { orgId: auth.org_id }, _avg: { trustScore: true } })
    ]);
    return jsonOk({
      total_customers: customers,
      transactions_today: transactionsToday,
      flagged_count: flagged,
      avg_trust_score: Math.round(trustAgg._avg.trustScore || 0)
    }, requestId);
  }

  if (key === "transactions") {
    if (!auth.org_id) return jsonError("missing org", requestId, 400);
    const limit = Number(request.nextUrl.searchParams.get("limit") || 20);
    return jsonOk(await prisma.transaction.findMany({
      where: { orgId: auth.org_id },
      orderBy: { createdAt: "desc" },
      take: limit
    }), requestId);
  }

  if (params.path?.[0] === "transactions" && params.path?.[1]) {
    const transactionId = String(params.path[1]);
    const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction) return jsonError("transaction not found", requestId, 404);
    if (auth.role !== "super_admin" && transaction.orgId !== auth.org_id) return jsonError("forbidden", requestId, 403);
    const [customer, recentTransactions] = await Promise.all([
      prisma.bankCustomer.findUnique({ where: { id: transaction.customerId } }),
      prisma.transaction.findMany({
        where: { customerId: transaction.customerId },
        orderBy: { createdAt: "desc" },
        take: 10
      })
    ]);
    return jsonOk({ ...transaction, customer, recentTransactions }, requestId);
  }

  if (key === "customers") {
    if (!auth.org_id) return jsonError("missing org", requestId, 400);
    const limit = Number(request.nextUrl.searchParams.get("limit") || 20);
    return jsonOk(await prisma.bankCustomer.findMany({
      where: { orgId: auth.org_id },
      orderBy: { createdAt: "desc" },
      take: limit
    }), requestId);
  }

  if (params.path?.[0] === "customers" && params.path?.[1]) {
    const customerId = String(params.path[1]);
    const customer = await prisma.bankCustomer.findUnique({ where: { id: customerId } });
    if (!customer) return jsonError("customer not found", requestId, 404);
    if (auth.role !== "super_admin" && customer.orgId !== auth.org_id) return jsonError("forbidden", requestId, 403);
    const [trustHistory, transactions, creditInputs] = await Promise.all([
      prisma.trustScoreHistory.findMany({ where: { customerId }, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.transaction.findMany({ where: { customerId }, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.creditInput.findMany({ where: { customerId }, orderBy: { createdAt: "desc" }, take: 20 })
    ]);
    const sources = Object.fromEntries(creditInputs.map((item) => [item.inputType, item.data]));
    const creditSummary = Object.keys(sources).length
      ? await aiEngineService.scoreCredit<{ credit_score: number; rating: string; breakdown: Record<string, number>; loan_eligibility: string }>({ sources }, requestId)
      : null;
    return jsonOk({ ...customer, trustHistory, transactions, creditInputs, creditSummary }, requestId);
  }

  if (key === "audit-logs") {
    if (!auth.org_id) return jsonError("missing org", requestId, 400);
    return jsonOk(await prisma.auditLog.findMany({ where: { orgId: auth.org_id }, orderBy: { createdAt: "desc" }, take: 50 }), requestId);
  }

  if (key === "billing") {
    if (!auth.org_id) return jsonError("missing org", requestId, 400);
    const [org, events, settings, goLiveRequests] = await Promise.all([
      prisma.organization.findUnique({ where: { id: auth.org_id } }),
      prisma.billingEvent.findMany({ where: { orgId: auth.org_id }, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.orgSetting.findUnique({ where: { orgId: auth.org_id } }),
      prisma.goLiveRequest.findMany({ where: { orgId: auth.org_id }, orderBy: { createdAt: "desc" }, take: 10 })
    ]);
    return jsonOk({ org, events, settings, goLiveRequests }, requestId);
  }

  if (key === "auth/2fa") {
    if (!auth.sub || !auth.email) return jsonError("missing user", requestId, 400);
    let security = await prisma.userSecurity.findUnique({ where: { userId: auth.sub } });
    if (!security) {
      security = await prisma.userSecurity.create({
        data: { userId: auth.sub, totpSecret: generateTotpSecret(), totpEnabled: false }
      });
    }
    return jsonOk({
      enabled: security.totpEnabled,
      secret: security.totpSecret,
      otpauth_url: security.totpSecret ? buildOtpAuthUri(security.totpSecret, auth.email) : null
    }, requestId);
  }

  if (key === "admin/go-live-requests") {
    if (!hasRole(auth.role, ["super_admin"])) return jsonError("forbidden", requestId, 403);
    return jsonOk(await prisma.goLiveRequest.findMany({ orderBy: { createdAt: "desc" }, take: 50 }), requestId);
  }

  if (key === "admin/orgs") {
    if (!hasRole(auth.role, ["super_admin"])) return jsonError("forbidden", requestId, 403);
    return jsonOk(await prisma.organization.findMany({ orderBy: { createdAt: "desc" } }), requestId);
  }

  if (key === "admin/metrics") {
    if (!hasRole(auth.role, ["super_admin"])) return jsonError("forbidden", requestId, 403);
    const [orgs, apiCalls, flagged, scores, failedJobs, queuedJobs] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.aggregate({ _sum: { apiCallCount: true } }),
      prisma.transaction.count({ where: { decision: { in: ["verify", "block"] } } }),
      prisma.bankCustomer.aggregate({ _avg: { trustScore: true, creditScore: true } }),
      prisma.failedJob.count(),
      prisma.backgroundJob.count({ where: { status: "queued" } })
    ]);
    return jsonOk({
      total_orgs: orgs,
      total_api_calls: apiCalls._sum.apiCallCount || 0,
      flagged_transactions: flagged,
      avg_trust_score: Math.round(scores._avg.trustScore || 0),
      avg_credit_score: Math.round(scores._avg.creditScore || 0),
      failed_jobs: failedJobs,
      queued_jobs: queuedJobs
    }, requestId);
  }

  if (key === "admin/failed-jobs") {
    if (!hasRole(auth.role, ["super_admin"])) return jsonError("forbidden", requestId, 403);
    const [failedJobs, backgroundJobs] = await Promise.all([
      prisma.failedJob.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.backgroundJob.findMany({ where: { status: { in: ["queued", "failed"] } }, orderBy: { createdAt: "desc" }, take: 50 })
    ]);
    return jsonOk({ failedJobs, backgroundJobs }, requestId);
  }

  return jsonError("not found", requestId, 404);
}

export async function POST(request: NextRequest, { params }: { params: { path?: string[] } }) {
  const requestId = crypto.randomUUID();
  const authOrResponse = await requireInternal(request, requestId);
  if (authOrResponse instanceof Response) return authOrResponse;
  const auth = authOrResponse;
  const body = await request.json().catch(() => ({}));
  const key = pathKey(params);

  if (key === "api-keys") {
    if (!hasRole(auth.role, ["bank_admin", "bank_developer", "super_admin"]) || !auth.org_id || !auth.sub) return jsonError("forbidden", requestId, 403);
    const parsed = z.object({ name: z.string(), environment: z.enum(["sandbox", "production"]).default("sandbox") }).safeParse(body);
    if (!parsed.success) return jsonError("invalid request", requestId, 400);
    const generated = generateApiKey(parsed.data.environment);
    const created = await prisma.apiKey.create({
      data: {
        orgId: auth.org_id,
        createdBy: auth.sub,
        name: parsed.data.name,
        keyHash: await hashApiKey(generated.raw),
        keyPrefix: generated.prefix,
        environment: parsed.data.environment
      }
    });
    return jsonOk({ id: created.id, key: generated.raw, key_prefix: generated.prefix, environment: parsed.data.environment, warning: "This key will not be shown again." }, requestId, 201);
  }

  if (key === "webhooks") {
    if (!hasRole(auth.role, ["bank_admin"]) || !auth.org_id) return jsonError("invalid request", requestId, 400);
    const parsed = z.object({ url: z.string().url(), events: z.array(z.string()).min(1), secret: z.string().min(8) }).safeParse(body);
    if (!parsed.success) return jsonError("invalid request", requestId, 400);
    const webhook = await prisma.webhook.create({ data: { orgId: auth.org_id, url: parsed.data.url, events: parsed.data.events, secret: parsed.data.secret } });
    return jsonOk({ webhook_id: webhook.id }, requestId, 201);
  }

  if (params.path?.[0] === "webhooks" && params.path?.[2] === "test") {
    if (!hasRole(auth.role, ["bank_admin"]) || !auth.org_id) return jsonError("invalid request", requestId, 400);
    const webhook = await prisma.webhook.findFirst({ where: { id: String(params.path?.[1]), orgId: auth.org_id } });
    if (!webhook) return jsonError("webhook not found", requestId, 404);
    await sendWebhook(webhook.url, webhook.secret, "webhook.test", {
      webhook_id: webhook.id,
      organization_id: webhook.orgId,
      message: "This is a TrustLayer test delivery"
    });
    return jsonOk({ tested: true }, requestId);
  }

  if (key === "team/invite") {
    if (!hasRole(auth.role, ["bank_admin"]) || !auth.org_id || !auth.sub) return jsonError("invalid request", requestId, 400);
    const parsed = z.object({ email: z.string().email(), role: z.enum(["bank_admin", "bank_developer"]) }).safeParse(body);
    if (!parsed.success) return jsonError("invalid request", requestId, 400);
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) return jsonError("user with that email already exists", requestId, 409);
    const org = await prisma.organization.findUnique({ where: { id: auth.org_id } });
    if (!org) return jsonError("organization not found", requestId, 404);
    const inviter = await prisma.user.findUnique({ where: { id: auth.sub } });
    const invite = await prisma.invitation.create({
      data: { orgId: auth.org_id, email: parsed.data.email, role: parsed.data.role, invitedBy: auth.sub, token: crypto.randomUUID() }
    });
    const mailResult = await sendInviteEmail({
      to: invite.email,
      invitedByName: inviter?.fullName || inviter?.email || null,
      organizationName: org.name,
      role: invite.role as "bank_admin" | "bank_developer",
      inviteToken: invite.token
    });
    return jsonOk({ invite_id: invite.id, email_sent: mailResult.sent }, requestId, 201);
  }

  if (key === "admin/orgs") {
    if (!hasRole(auth.role, ["super_admin"])) return jsonError("forbidden", requestId, 403);
    const parsed = z.object({
      name: z.string(),
      slug: z.string(),
      plan: z.enum(["starter", "growth", "enterprise"]).default("starter"),
      admin_email: z.string().email()
    }).safeParse(body);
    if (!parsed.success) return jsonError("invalid request", requestId, 400);

    const org = await prisma.organization.create({
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        plan: parsed.data.plan
      }
    });
    const invite = await prisma.invitation.create({
      data: {
        orgId: org.id,
        email: parsed.data.admin_email,
        role: "bank_admin",
        token: crypto.randomUUID()
      }
    });
    const sender = auth.sub ? await prisma.user.findUnique({ where: { id: auth.sub } }) : null;
    const mailResult = await sendInviteEmail({
      to: invite.email,
      invitedByName: sender?.fullName || sender?.email || null,
      organizationName: org.name,
      role: "bank_admin",
      inviteToken: invite.token
    });
    return jsonOk({ ...org, invite, email_sent: mailResult.sent }, requestId, 201);
  }

  if (key === "billing/go-live-request") {
    if (!hasRole(auth.role, ["bank_admin"]) || !auth.org_id || !auth.sub) return jsonError("invalid request", requestId, 400);
    const parsed = z.object({
      company_name: z.string().min(2),
      rc_number: z.string().optional(),
      bank_name: z.string().optional(),
      account_name: z.string().optional(),
      account_number: z.string().optional(),
      use_case_description: z.string().min(10)
    }).safeParse(body);
    if (!parsed.success) return jsonError("invalid request", requestId, 400);
    const created = await prisma.goLiveRequest.create({
      data: {
        orgId: auth.org_id,
        submittedBy: auth.sub,
        companyName: parsed.data.company_name,
        rcNumber: parsed.data.rc_number,
        businessDetails: { bank_name: parsed.data.bank_name, account_name: parsed.data.account_name, account_number: parsed.data.account_number } as Prisma.InputJsonValue,
        useCaseDescription: parsed.data.use_case_description,
        status: "pending"
      }
    });
    await prisma.billingEvent.create({
      data: { orgId: auth.org_id, eventType: "go_live_requested", amountKobo: BigInt(0), status: "pending", metadata: { go_live_request_id: created.id } as Prisma.InputJsonValue }
    });
    return jsonOk(created, requestId, 201);
  }

  if (key === "auth/2fa/enable" || key === "auth/2fa/verify" || key === "auth/2fa/disable") {
    if (!auth.sub || !auth.email) return jsonError("missing user", requestId, 400);
    const parsed = z.object({ code: z.string().min(6), secret: z.string().optional() }).safeParse(body);
    if (!parsed.success) return jsonError("invalid request", requestId, 400);
    const security = await prisma.userSecurity.findUnique({ where: { userId: auth.sub } });

    if (key === "auth/2fa/enable") {
      const secret = parsed.data.secret || security?.totpSecret || generateTotpSecret();
      if (!verifyTotp(secret, parsed.data.code)) return jsonError("invalid authentication code", requestId, 400);
      const updated = await prisma.userSecurity.upsert({
        where: { userId: auth.sub },
        update: { totpSecret: secret, totpEnabled: true, updatedAt: new Date() },
        create: { userId: auth.sub, totpSecret: secret, totpEnabled: true }
      });
      return jsonOk({ enabled: updated.totpEnabled, otpauth_url: buildOtpAuthUri(secret, auth.email) }, requestId);
    }

    if (!security?.totpEnabled || !security.totpSecret) {
      return key === "auth/2fa/disable" ? jsonOk({ disabled: true }, requestId) : jsonError("2fa not enabled", requestId, 400);
    }
    if (!verifyTotp(security.totpSecret, parsed.data.code)) return jsonError("invalid authentication code", requestId, 400);
    if (key === "auth/2fa/verify") return jsonOk({ verified: true }, requestId);

    await prisma.userSecurity.update({
      where: { userId: auth.sub },
      data: { totpEnabled: false, totpSecret: null, updatedAt: new Date() }
    });
    return jsonOk({ disabled: true }, requestId);
  }

  if (params.path?.[0] === "customers" && params.path?.[2] === "statement-upload") {
    if (!auth.org_id) return jsonError("missing org context", requestId, 400);
    const parsed = z.object({ content: z.string().min(1), file_type: z.enum(["pdf", "csv"]).default("pdf") }).safeParse(body);
    if (!parsed.success) return jsonError("invalid request", requestId, 400);
    const customerId = String(params.path?.[1]);
    const customer = await prisma.bankCustomer.findFirst({ where: { id: customerId, orgId: auth.org_id } });
    if (!customer) return jsonError("customer not found", requestId, 404);
    const job = await enqueueJob({ orgId: auth.org_id, customerId, jobType: "statement_parse_credit_refresh", priority: "normal", payload: { file_type: parsed.data.file_type } });
    let parsedStatement: Record<string, unknown>;
    let creditResult;
    try {
      parsedStatement = await aiEngineService.parseStatement<Record<string, unknown>>({ content: parsed.data.content, file_type: parsed.data.file_type }, requestId);
      creditResult = await analyzeCredit(auth.org_id, { customer_id: customerId, data_type: "bank_statement", data: parsedStatement });
      await completeJob(job.id, { parse_metadata: parsedStatement.parse_metadata || {}, customer_id: customerId });
    } catch (error) {
      await failJob(job.id, error instanceof Error ? error.message : "statement upload failed");
      return jsonError(error instanceof Error ? error.message : "statement upload failed", requestId, 422);
    }
    return jsonOk({ job_id: job.id, parsed_statement: parsedStatement, credit_result: creditResult }, requestId, 201);
  }

  if (key === "admin/monthly-reset") {
    if (!hasRole(auth.role, ["super_admin"])) return jsonError("forbidden", requestId, 403);
    return jsonOk(await resetMonthlyUsageCounts(), requestId);
  }

  if (params.path?.[0] === "admin" && params.path?.[1] === "go-live-requests" && params.path?.[3] === "approve") {
    if (!hasRole(auth.role, ["super_admin"])) return jsonError("forbidden", requestId, 403);
    const parsed = z.object({ action: z.enum(["approved", "rejected"]).default("approved"), review_notes: z.string().optional() }).safeParse(body);
    if (!parsed.success || !auth.sub) return jsonError("invalid request", requestId, 400);
    const requestRecord = await prisma.goLiveRequest.findUnique({ where: { id: String(params.path?.[2]) } });
    if (!requestRecord) return jsonError("go live request not found", requestId, 404);
    const [updated] = await prisma.$transaction([
      prisma.goLiveRequest.update({
        where: { id: requestRecord.id },
        data: {
          status: parsed.data.action,
          reviewNotes: parsed.data.review_notes,
          reviewedBy: auth.sub,
          reviewedAt: new Date(),
          updatedAt: new Date()
        }
      }),
      prisma.orgSetting.upsert({
        where: { orgId: requestRecord.orgId },
        update: { liveEnabled: parsed.data.action === "approved", updatedAt: new Date() },
        create: { orgId: requestRecord.orgId, liveEnabled: parsed.data.action === "approved" }
      }),
      prisma.billingEvent.create({
        data: {
          orgId: requestRecord.orgId,
          eventType: parsed.data.action === "approved" ? "go_live_approved" : "go_live_rejected",
          amountKobo: BigInt(0),
          status: parsed.data.action,
          metadata: { go_live_request_id: requestRecord.id, review_notes: parsed.data.review_notes || null } as Prisma.InputJsonValue
        }
      })
    ]);
    return jsonOk(updated, requestId);
  }

  if (params.path?.[0] === "admin" && params.path?.[1] === "failed-jobs" && params.path?.[3] === "retry") {
    if (!hasRole(auth.role, ["super_admin"])) return jsonError("forbidden", requestId, 403);
    const failed = await prisma.failedJob.findUnique({ where: { id: String(params.path?.[2]) } });
    if (!failed) return jsonError("failed job not found", requestId, 404);
    const retried = await enqueueJob({
      orgId: failed.orgId || undefined,
      jobType: failed.jobType,
      priority: "normal",
      payload: ((failed.payload as Prisma.InputJsonValue | null) ?? {}) as Prisma.InputJsonValue
    });
    await prisma.failedJob.update({ where: { id: failed.id }, data: { retryCount: { increment: 1 }, lastRetriedAt: new Date() } });
    return jsonOk({ retried_job_id: retried.id }, requestId);
  }

  return jsonError("not found", requestId, 404);
}

export async function PATCH(request: NextRequest, { params }: { params: { path?: string[] } }) {
  const requestId = crypto.randomUUID();
  const authOrResponse = await requireInternal(request, requestId);
  if (authOrResponse instanceof Response) return authOrResponse;
  const auth = authOrResponse;
  const body = await request.json().catch(() => ({}));

  if (pathKey(params) === "billing/settings") {
    if (!hasRole(auth.role, ["bank_admin"]) || !auth.org_id) return jsonError("missing org", requestId, 400);
    const parsed = z.object({
      fail_open_mode: z.enum(["allow", "verify"]).optional(),
      squad_enabled: z.boolean().optional(),
      preferred_assistant_name: z.string().optional(),
      preferred_greeting: z.string().optional(),
      sandbox_mode: z.boolean().optional(),
      live_enabled: z.boolean().optional()
    }).safeParse(body);
    if (!parsed.success) return jsonError("invalid request", requestId, 400);
    const settings = await prisma.orgSetting.upsert({
      where: { orgId: auth.org_id },
      update: {
        failOpenMode: parsed.data.fail_open_mode,
        squadEnabled: parsed.data.squad_enabled,
        preferredAssistantName: parsed.data.preferred_assistant_name,
        preferredGreeting: parsed.data.preferred_greeting,
        sandboxMode: parsed.data.sandbox_mode,
        liveEnabled: parsed.data.live_enabled,
        updatedAt: new Date()
      },
      create: {
        orgId: auth.org_id,
        failOpenMode: parsed.data.fail_open_mode || "verify",
        squadEnabled: parsed.data.squad_enabled || false,
        preferredAssistantName: parsed.data.preferred_assistant_name,
        preferredGreeting: parsed.data.preferred_greeting,
        sandboxMode: parsed.data.sandbox_mode ?? true,
        liveEnabled: parsed.data.live_enabled ?? false
      }
    });
    return jsonOk(settings, requestId);
  }

  if (params.path?.[0] === "admin" && params.path?.[1] === "orgs" && params.path?.[2]) {
    if (!hasRole(auth.role, ["super_admin"])) return jsonError("forbidden", requestId, 403);
    const parsed = z.object({
      plan: z.enum(["starter", "growth", "enterprise"]).optional(),
      status: z.enum(["active", "suspended"]).optional()
    }).safeParse(body);
    if (!parsed.success) return jsonError("invalid request", requestId, 400);
    const updated = await prisma.organization.update({
      where: { id: String(params.path[2]) },
      data: parsed.data
    });
    return jsonOk(updated, requestId);
  }

  return jsonError("not found", requestId, 404);
}

export async function DELETE(request: NextRequest, { params }: { params: { path?: string[] } }) {
  const requestId = crypto.randomUUID();
  const authOrResponse = await requireInternal(request, requestId);
  if (authOrResponse instanceof Response) return authOrResponse;
  const auth = authOrResponse;

  if (params.path?.[0] === "api-keys" && params.path?.[1]) {
    if (!hasRole(auth.role, ["bank_admin", "bank_developer"])) return jsonError("forbidden", requestId, 403);
    await prisma.apiKey.update({ where: { id: String(params.path?.[1]) }, data: { isActive: false } });
    return jsonOk({ revoked: true }, requestId);
  }

  return jsonError("not found", requestId, 404);
}
  export const maxDuration = 30; // seconds