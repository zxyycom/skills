import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { gateImpactContractVersion } from "./impact-catalog.ts";

const receiptFormatVersion = 1;
const receiptFileName = "receipts.json";

export type GateReceipt = Readonly<{
  checkId: string;
  fingerprint: string;
  outcome: "passed";
}>;

type GateReceiptManifest = Readonly<{
  contractVersion: typeof gateImpactContractVersion;
  formatVersion: typeof receiptFormatVersion;
  receipts: readonly GateReceipt[];
}>;

function isReceipt(value: unknown): value is GateReceipt {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).sort().join(",") === "checkId,fingerprint,outcome" &&
    typeof record.checkId === "string" &&
    typeof record.fingerprint === "string" &&
    /^[a-f0-9]{64}$/u.test(record.fingerprint) &&
    record.outcome === "passed"
  );
}

function parseReceiptManifest(value: unknown): GateReceiptManifest | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(",") !==
      "contractVersion,formatVersion,receipts" ||
    record.contractVersion !== gateImpactContractVersion ||
    record.formatVersion !== receiptFormatVersion ||
    !Array.isArray(record.receipts) ||
    !record.receipts.every(isReceipt)
  ) {
    return null;
  }
  const receipts = record.receipts as GateReceipt[];
  if (
    new Set(receipts.map(({ checkId }) => checkId)).size !== receipts.length
  ) {
    return null;
  }
  return {
    contractVersion: gateImpactContractVersion,
    formatVersion: receiptFormatVersion,
    receipts
  };
}

export async function readReceiptManifest(cacheDirectory: string): Promise<
  Readonly<{
    manifest: GateReceiptManifest | null;
    state: "invalid" | "missing" | "valid";
  }>
> {
  try {
    const parsed: unknown = JSON.parse(
      await fs.readFile(path.join(cacheDirectory, receiptFileName), "utf8")
    );
    const manifest = parseReceiptManifest(parsed);
    return manifest === null
      ? { manifest: null, state: "invalid" }
      : { manifest, state: "valid" };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return { manifest: null, state: "missing" };
    }
    return { manifest: null, state: "invalid" };
  }
}

export async function writeReceiptManifest(
  cacheDirectory: string,
  receipts: readonly GateReceipt[]
): Promise<void> {
  await fs.mkdir(cacheDirectory, { recursive: true });
  const target = path.join(cacheDirectory, receiptFileName);
  const temporary = path.join(
    cacheDirectory,
    `.${receiptFileName}.${process.pid}.${randomUUID()}.tmp`
  );
  const manifest: GateReceiptManifest = {
    contractVersion: gateImpactContractVersion,
    formatVersion: receiptFormatVersion,
    receipts
  };
  try {
    await fs.writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, {
      mode: 0o600
    });
    await fs.rename(temporary, target);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}
