import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Prisma } from "@prisma/client";

import { prisma } from "../src/lib/prisma.js";
import { delKey } from "../src/services/upstash.service.js";

/**
 * Seeds ~6 months of realistic outgoing-transaction history for one bank
 * customer, straight into the transactions table (bypassing the analyze API,
 * the same way trustlayer/supabase/seed.sql seeds its two demo rows). This
 * is what `getCustomerBaseline()` reads to compute avg_amount, known
 * locations, and known devices — without it, every scenario in the Attack
 * Console is "anomalous" against an empty baseline, and none of it means
 * anything.
 *
 * Usage:
 *   tsx scripts/seed-demo-customer.ts <external-id> [org-id]
 *
 * <external-id> must already exist as a bank_customers row — i.e. the
 * demo user has already completed onboarding in test-bank-app (which calls
 * POST /customer/register with external_id = their Supabase auth user id).
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.resolve(
  __dirname,
  "../../../test-data/hamduk-wallet-statement-amisu-omotayo-2025-10-to-2026-03.csv"
);

const DEFAULT_ORG_ID = "22222222-2222-2222-2222-222222222222"; // "Demo Bank" from supabase/seed.sql
const DEMO_DEVICES = ["device_iphone13_demo", "device_galaxy_a34_demo"];

type CsvRow = Record<string, string>;

function parseCsv(text: string): CsvRow[] {
  const [headerLine, ...lines] = text.trim().split("\n");
  const headers = headerLine.split('","').map((h) => h.replace(/^"|"$/g, ""));
  return lines
    .filter(Boolean)
    .map((line) => {
      const values = line.split('","').map((v) => v.replace(/^"|"$/g, ""));
      const row: CsvRow = {};
      headers.forEach((header, index) => {
        row[header] = values[index] ?? "";
      });
      return row;
    });
}

/** Consistent device assignment so "known_devices" in the baseline is stable across reruns. */
function pickDevice(channel: string): string {
  return channel === "POS" || channel === "CARD" ? DEMO_DEVICES[0] : DEMO_DEVICES[1];
}

async function main() {
  const externalId = process.argv[2];
  const orgId = process.argv[3] || DEFAULT_ORG_ID;

  if (!externalId) {
    console.error("Usage: tsx scripts/seed-demo-customer.ts <external-id> [org-id]");
    console.error("<external-id> is the Supabase auth user id of the already-onboarded demo customer.");
    process.exit(1);
  }

  const customer = await prisma.bankCustomer.findUnique({
    where: { orgId_externalId: { orgId, externalId } }
  });

  if (!customer) {
    console.error(
      `No bank_customers row for org ${orgId} / external_id ${externalId}. ` +
        "Onboard this user through the app first (it calls POST /customer/register), then re-run this script."
    );
    process.exit(1);
  }

  const rows = parseCsv(readFileSync(CSV_PATH, "utf8"));
  const outgoing = rows.filter((row) => Number(row.debit_ngn) > 0);

  console.log(`Seeding ${outgoing.length} historical transactions for customer ${customer.id}...`);

  // Idempotent: clear any previously seeded history for this customer before reseeding.
  await prisma.transaction.deleteMany({
    where: { customerId: customer.id, externalTxId: { startsWith: "seed_hist_" } }
  });

  const records = outgoing.map((row) => {
    const amount = Number(row.debit_ngn);
    const isAirtimeOrData = /airtime|data bundle/i.test(row.description);

    return {
      orgId,
      customerId: customer.id,
      externalTxId: `seed_hist_${row.reference}`,
      amount,
      currency: "NGN",
      merchant: row.description,
      location: row.location,
      deviceId: pickDevice(row.channel),
      channel: row.channel.toLowerCase(),
      riskScore: isAirtimeOrData ? 5 : 12,
      riskFactors: [] as unknown as Prisma.InputJsonValue,
      decision: "allow",
      aiExplanation: "Matches this customer's established spending pattern.",
      status: "approved",
      createdAt: new Date(`${row.date}T${row.time}`)
    };
  });

  await prisma.transaction.createMany({ data: records });

  const avgAmount = records.reduce((sum, record) => sum + record.amount, 0) / records.length;
  const lastActivityAt = records.reduce(
    (latest, record) => (record.createdAt > latest ? record.createdAt : latest),
    records[0].createdAt
  );

  await prisma.bankCustomer.update({
    where: { id: customer.id },
    data: {
      totalTransactions: { increment: records.length },
      trustScore: Math.max(customer.trustScore, 720),
      riskTier: "trusted",
      lastActivityAt
    }
  });

  // Baseline is cached for 5 minutes — clear it so the next analyze() call
  // picks up this history immediately instead of the old (empty) baseline.
  await delKey(`baseline:${customer.id}`).catch(() => undefined);

  console.log(`Seeded ${records.length} transactions.`);
  console.log(`Average historical amount: ~₦${Math.round(avgAmount).toLocaleString()}`);
  console.log(`Known locations: ${[...new Set(records.map((record) => record.location))].join(", ")}`);
  console.log(`Known devices: ${DEMO_DEVICES.join(", ")}`);
  console.log("Baseline cache cleared.");

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
