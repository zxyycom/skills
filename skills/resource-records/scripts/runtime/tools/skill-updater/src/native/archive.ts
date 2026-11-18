/*
 * Synced TypeScript runtime; repository maintenance edits tools/skill-updater/src/native/archive.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/skill-updater/src/native/archive.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/skill-updater/src/native/archive.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/resource-records
 * Rebuild: bun run sync:resource-records-cli
 */
import { Inflate } from "fflate";
import { assertNativeRelativePaths } from "../../../skill-package/src/native-paths.ts";

const MAX_ENTRIES = 4096;
const MAX_OUTPUT_BYTES = 128 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 128 * 1024 * 1024;
const utf8 = new TextDecoder("utf-8", { fatal: true });

type CentralEntry = Readonly<{
  name: string;
  size: number;
  compressed: number;
  offset: number;
  flags: number;
  method: number;
}>;

function endRecord(data: Buffer): number {
  const end = data.length - 22;
  if (
    data.readUInt32LE(end) !== 0x06054b50 ||
    data.readUInt16LE(end + 20) !== 0
  )
    throw new Error("ZIP comments or invalid end record are unsupported");
  return end;
}

function assertArchiveLength(data: Buffer): void {
  if (data.length < 22 || data.length > MAX_ARCHIVE_BYTES)
    throw new Error("invalid ZIP length");
}

function readDirectoryHeader(data: Buffer): {
  end: number;
  count: number;
  offset: number;
} {
  assertArchiveLength(data);
  const end = endRecord(data);
  if (end !== data.length - 22) throw new Error("ZIP comments are unsupported");
  if (end >= 20) {
    const locator = data.readUInt32LE(end - 20);
    if (locator === 0x07064b50) throw new Error("ZIP64 is unsupported");
  }
  const count = data.readUInt16LE(end + 10);
  const size = data.readUInt32LE(end + 12);
  const offset = data.readUInt32LE(end + 16);
  assertSingleDisk(data, end, count);
  if (count === 0 || count > MAX_ENTRIES)
    throw new Error("unsupported ZIP directory");
  if (offset + size !== end) throw new Error("unsupported ZIP directory");
  return { end, count, offset };
}

function assertSingleDisk(data: Buffer, end: number, count: number): void {
  const disk = data.readUInt16LE(end + 4);
  const directoryDisk = data.readUInt16LE(end + 6);
  const diskCount = data.readUInt16LE(end + 8);
  if ([disk, directoryDisk].some((value) => value !== 0))
    throw new Error("multi-disk ZIP is unsupported");
  if (diskCount !== count) throw new Error("multi-disk ZIP is unsupported");
}

function validateDirectoryContents(
  data: Buffer,
  entries: CentralEntry[],
  offset: number
): void {
  if (
    entries.reduce((total, entry) => total + entry.size, 0) > MAX_OUTPUT_BYTES
  )
    throw new Error("ZIP output exceeds limit");
  assertNativeRelativePaths(entries.map((entry) => entry.name));
  const ranges = entries.map((entry) =>
    validateLocalEntry(data, entry, offset)
  );
  ranges.sort((left, right) => left.start - right.start);
  for (let i = 1; i < ranges.length; i++)
    if (ranges[i - 1]!.end > ranges[i]!.start)
      throw new Error("overlapping ZIP local entries");
}

function centralEntries(data: Buffer): CentralEntry[] {
  const { end, count, offset } = readDirectoryHeader(data);
  const entries: CentralEntry[] = [];
  let cursor = offset;
  for (let i = 0; i < count; i++) {
    const result = readCentralEntry(data, cursor, end);
    entries.push(result.entry);
    cursor = result.next;
  }
  if (cursor !== end) throw new Error("invalid ZIP central directory length");
  validateDirectoryContents(data, entries, offset);
  return entries;
}

function readCentralEntry(
  data: Buffer,
  cursor: number,
  end: number
): { entry: CentralEntry; next: number } {
  if (cursor + 46 > end || data.readUInt32LE(cursor) !== 0x02014b50) {
    throw new Error("invalid ZIP central entry");
  }
  const nameLength = data.readUInt16LE(cursor + 28);
  let next = cursor + 46;
  next += nameLength;
  next += data.readUInt16LE(cursor + 30);
  next += data.readUInt16LE(cursor + 32);
  if (next > end || nameLength === 0) {
    throw new Error("invalid ZIP entry length");
  }
  const flags = data.readUInt16LE(cursor + 8);
  const method = data.readUInt16LE(cursor + 10);
  validateCentralType(data, cursor, flags, method);
  const nameStart = cursor + 46;
  const nameEnd = nameStart + nameLength;
  const nameBytes = data.subarray(nameStart, nameEnd);
  const isAscii = nameBytes.every((byte) => byte <= 0x7f);
  if ((flags & 0x0800) === 0 && !isAscii) {
    throw new Error("ZIP non-ASCII names must use UTF-8");
  }
  const name = utf8.decode(nameBytes);
  if (name === "__proto__") throw new Error("unsafe ZIP member name");
  const entry = {
    name,
    size: data.readUInt32LE(cursor + 24),
    compressed: data.readUInt32LE(cursor + 20),
    offset: data.readUInt32LE(cursor + 42),
    flags,
    method
  };
  return { entry, next };
}

function validateCentralType(
  data: Buffer,
  cursor: number,
  flags: number,
  method: number
): void {
  const os = data.readUInt16LE(cursor + 4) >>> 8;
  const attributes = data.readUInt32LE(cursor + 38);
  const kind = (attributes >>> 16) & 0o170000;
  if (
    (flags & ~0x0806) !== 0 ||
    (method !== 0 && method !== 8) ||
    data.readUInt16LE(cursor + 34) !== 0 ||
    (os === 3 && kind !== 0 && kind !== 0o100000) ||
    (attributes & 0x10) !== 0
  )
    throw new Error("unsupported ZIP file type or encoding");
}

function validateLocalEntry(
  data: Buffer,
  entry: CentralEntry,
  centralOffset: number
): { start: number; end: number } {
  const offset = entry.offset;
  if (offset + 30 > centralOffset) {
    throw new Error("invalid ZIP local entry");
  }
  const signature = data.readUInt32LE(offset);
  if (signature !== 0x04034b50) {
    throw new Error("invalid ZIP local entry");
  }
  const length = data.readUInt16LE(offset + 26);
  let start = offset + 30;
  start += length;
  start += data.readUInt16LE(offset + 28);
  if (start + entry.compressed > centralOffset) {
    throw new Error("ZIP local data crosses central directory");
  }
  const flags = data.readUInt16LE(offset + 6);
  const method = data.readUInt16LE(offset + 8);
  const compressed = data.readUInt32LE(offset + 18);
  const size = data.readUInt32LE(offset + 22);
  if (flags !== entry.flags || method !== entry.method) {
    throw new Error("ZIP local and central entries disagree");
  }
  if (compressed !== entry.compressed || size !== entry.size) {
    throw new Error("ZIP local and central entries disagree");
  }
  const nameStart = offset + 30;
  const nameBytes = data.subarray(nameStart, nameStart + length);
  const name = utf8.decode(nameBytes);
  if (name !== entry.name)
    throw new Error("ZIP local and central entries disagree");
  return { start: offset, end: start + entry.compressed };
}

function expandMember(data: Buffer, entry: CentralEntry): Buffer {
  const nameLength = data.readUInt16LE(entry.offset + 26);
  const extraLength = data.readUInt16LE(entry.offset + 28);
  const start = entry.offset + 30 + nameLength + extraLength;
  const compressed = data.subarray(start, start + entry.compressed);
  if (entry.method === 0) {
    if (compressed.length !== entry.size)
      throw new Error(`ZIP member length mismatch: ${entry.name}`);
    return Buffer.from(compressed);
  }
  const chunks: Buffer[] = [];
  let total = 0;
  const inflater = new Inflate((chunk) => {
    total += chunk.byteLength;
    if (total > entry.size)
      throw new Error(`ZIP member exceeds declared size: ${entry.name}`);
    chunks.push(Buffer.from(chunk));
  });
  const chunkSize = 256;
  for (let offset = 0; offset < compressed.length; offset += chunkSize) {
    const end = Math.min(compressed.length, offset + chunkSize);
    inflater.push(compressed.subarray(offset, end), end === compressed.length);
  }
  if (compressed.length === 0) inflater.push(new Uint8Array(), true);
  if (total !== entry.size)
    throw new Error(`ZIP member length mismatch: ${entry.name}`);
  return Buffer.concat(chunks, total);
}

/** Validate all names and file types before expanding any member. */
export function extractNativeArchive(
  data: Uint8Array
): ReadonlyMap<string, Buffer> {
  const bytes = Buffer.from(data);
  const entries = centralEntries(bytes);
  const result = new Map<string, Buffer>();
  for (const entry of entries)
    result.set(entry.name, expandMember(bytes, entry));
  return result;
}
