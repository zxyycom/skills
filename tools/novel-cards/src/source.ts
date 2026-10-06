import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import type { Stats } from "node:fs";
import path from "node:path";
import {
  CardFailure,
  parseCardRecord,
  validateCards,
  type CardRecord
} from "./card.ts";
import type { StateSourceRevision } from "../../index-runtime/src/index.ts";

export type Source = Readonly<{
  records: readonly CardRecord[];
  revision: StateSourceRevision;
}>;
const maxCards = 10000;
const maxFileBytes = 2 * 1024 * 1024;
const maxTotalBytes = 20 * 1024 * 1024;

async function requireDirectory(directory: string): Promise<void> {
  let info: Stats;
  try {
    info = await fs.lstat(directory);
  } catch (error) {
    throw sourceReadFailure(error, directory);
  }
  if (!info.isDirectory())
    throw new CardFailure("source-path", directory, "拒绝符号链接或非目录");
}

async function referenceExists(directory: string): Promise<boolean> {
  try {
    await fs.lstat(directory);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return false;
    throw sourceReadFailure(error, directory);
  }
}

function sourceReadFailure(error: unknown, file: string): CardFailure {
  if (error instanceof CardFailure) return error;
  return new CardFailure(
    "read-failed",
    file,
    error instanceof Error ? error.message : String(error)
  );
}

function verifyUnchanged(stat: Stats, after: Stats, file: string): void {
  const sameIdentity = stat.ino === after.ino && stat.dev === after.dev;
  const sameBytes = stat.size === after.size && stat.mtimeMs === after.mtimeMs;
  if (!sameIdentity || !sameBytes || !after.isFile() || after.nlink !== 1) {
    throw new CardFailure(
      "source-changed",
      file,
      "读取期间文件发生变化，请停止并发修改后重试"
    );
  }
}

class SourceScanner {
  private readonly records: CardRecord[] = [];
  private totalBytes = 0;
  constructor(private readonly root: string) {}

  async read(): Promise<Source> {
    await requireDirectory(this.root);
    const cardsPath = path.join(this.root, "cards");
    await requireDirectory(cardsPath);
    await this.visit(path.join(cardsPath, "current"), "current", 0);
    const referencePath = path.join(cardsPath, "reference");
    if (await referenceExists(referencePath))
      await this.visit(referencePath, "reference", 0);
    validateCards(this.records);
    return sourceResult(this.records);
  }

  private async visit(
    directory: string,
    area: "current" | "reference",
    depth: number
  ): Promise<void> {
    if (depth > 100)
      throw new CardFailure("source-limit", directory, "文件目录深度超过 100");
    await requireDirectory(directory);
    let names: string[];
    try {
      names = await fs.readdir(directory);
    } catch (error) {
      throw sourceReadFailure(error, directory);
    }
    for (const name of names.sort()) {
      const file = path.join(directory, name);
      try {
        const stat = await fs.lstat(file);
        if (stat.isDirectory()) await this.visit(file, area, depth + 1);
        else await this.readCard(file, area, stat);
      } catch (error) {
        throw sourceReadFailure(error, file);
      }
    }
  }

  private async readCard(
    file: string,
    area: "current" | "reference",
    stat: Stats
  ): Promise<void> {
    if (!stat.isFile() || stat.nlink !== 1 || !file.endsWith(".md"))
      throw new CardFailure(
        "source-path",
        file,
        "卡片区只允许普通单链接 Markdown 文件与目录"
      );
    this.totalBytes += stat.size;
    if (
      stat.size > maxFileBytes ||
      this.totalBytes > maxTotalBytes ||
      this.records.length >= maxCards
    )
      throw new CardFailure(
        "source-limit",
        file,
        "超过 10000 卡、2MiB/文件或20MiB/集合预算"
      );
    const bytes = await fs.readFile(file);
    let markdown: string;
    try {
      markdown = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new CardFailure("card-format", file, "卡片必须为合法 UTF-8 文本");
    }
    verifyUnchanged(stat, await fs.lstat(file), file);
    const sourcePath = path.relative(this.root, file).split(path.sep).join("/");
    this.records.push(parseCardRecord(markdown, sourcePath, area));
  }
}

export async function readSource(root: string): Promise<Source> {
  return await new SourceScanner(root).read();
}

function sourceResult(records: readonly CardRecord[]): Source {
  return {
    records,
    revision: {
      metadata: "novel-cards-v1",
      entries: Object.fromEntries(
        records.map((record) => [
          record.card.id,
          createHash("sha256")
            .update(
              JSON.stringify([
                record.sourcePath,
                record.markdown.replace(/\r\n/gu, "\n")
              ])
            )
            .digest("hex")
        ])
      )
    }
  };
}
