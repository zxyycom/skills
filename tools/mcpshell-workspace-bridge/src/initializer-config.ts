import fs from "node:fs/promises";
import path from "node:path";
import { BridgeError, type BridgeConfig } from "./shared.ts";
import type { InitializerAction } from "./initializer-contract.ts";

export const generatedToolsPath =
  "skills/mcpshell-workspace-tools/references/mcpshell-tools.yaml";
export const agentConfigResource = ".codex/config.toml";
export const environmentResource =
  "skills/mcpshell-workspace-tools/.env.mcpshell";

export function validateIdentity(identity: string): string {
  if (!/^[A-Za-z0-9_-]+$/u.test(identity)) {
    throw new BridgeError(
      "invalid_input",
      "identity must contain only letters, digits, underscores, and hyphens"
    );
  }
  return identity;
}

export function managedMarker(identity: string): string {
  return `# Managed by mcpshell-workspace-bridge: ${identity}`;
}

export function tableHeader(identity: string): string {
  return `[mcp_servers.${identity}]`;
}

export function renderedTable(identity: string): string {
  return `${managedMarker(identity)}\n${tableHeader(identity)}\ncommand = "mcpshell"\nargs = ["mcp", "--tools", "${generatedToolsPath}"]\n`;
}

export function findTableRange(
  source: string,
  identity: string
): Readonly<{ end: number; start: number }> | null {
  const header = tableHeader(identity);
  const match = new RegExp(
    `^[\t ]*${header.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}[\t ]*(?:#.*)?$`,
    "mu"
  ).exec(source);
  if (match === null || match.index === undefined) {
    return null;
  }
  const following = /\n[\t ]*\[/gu;
  following.lastIndex = match.index + match[0].length;
  const next = following.exec(source);
  return {
    start: match.index,
    end:
      next === null || next.index === undefined ? source.length : next.index + 1
  };
}

export function managedRange(
  source: string,
  identity: string
): Readonly<{ end: number; start: number }> | null {
  const start = source.indexOf(
    `${managedMarker(identity)}\n${tableHeader(identity)}\n`
  );
  if (start === -1) {
    return null;
  }
  const tableStart =
    start + `${managedMarker(identity)}\n${tableHeader(identity)}\n`.length;
  const following = /\n[\t ]*\[/gu;
  following.lastIndex = tableStart;
  const next = following.exec(source);
  return {
    start,
    end:
      next === null || next.index === undefined ? source.length : next.index + 1
  };
}

export function mergeTable(
  source: string,
  identity: string
): Readonly<{ action: InitializerAction["action"]; source: string }> {
  const owned = managedRange(source, identity);
  const table = findTableRange(source, identity);
  if (table !== null && owned === null) {
    throw new BridgeError(
      "config_invalid",
      `config_conflict: ${tableHeader(identity)} is not owned by this bridge`
    );
  }
  const rendered = renderedTable(identity);
  if (owned !== null) {
    const next = `${source.slice(0, owned.start)}${rendered}${source.slice(owned.end)}`;
    return { action: next === source ? "unchanged" : "update", source: next };
  }
  const separator = source.length === 0 || source.endsWith("\n") ? "" : "\n";
  return {
    action: "create",
    source: `${source}${separator}${source.length === 0 ? "" : "\n"}${rendered}`
  };
}

export function removeTable(
  source: string,
  identity: string
): Readonly<{ changed: boolean; source: string }> {
  const owned = managedRange(source, identity);
  const table = findTableRange(source, identity);
  if (table !== null && owned === null) {
    throw new BridgeError(
      "config_invalid",
      `config_conflict: ${tableHeader(identity)} is not owned by this bridge`
    );
  }
  if (owned === null) {
    return { changed: false, source };
  }
  const prefix = source.slice(0, owned.start);
  const suffix = source.slice(owned.end);
  return {
    changed: true,
    source: prefix + suffix
  };
}

export async function readOptionalText(
  filePath: string
): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function readTextIfPresent(filePath: string): Promise<string> {
  return (await readOptionalText(filePath)) ?? "";
}

export async function assertEnvironmentIgnore(
  skillDirectory: string
): Promise<void> {
  const ignorePath = path.join(skillDirectory, ".gitignore");
  const source = await readTextIfPresent(ignorePath);
  const matches = source
    .split(/\r?\n/u)
    .filter((line) => line === "/.env.mcpshell");
  if (matches.length !== 1) {
    throw new BridgeError(
      "config_invalid",
      "skill .gitignore must contain exactly one /.env.mcpshell rule"
    );
  }
}

export function renderEnvironment(config: BridgeConfig): string {
  return [
    `MCPSHELL_BACKEND_HANDLE=${config.backendHandle}`,
    `MCPSHELL_PROJECT_ROOT=${config.projectRoot}`,
    `MCPSHELL_STAGING_ROOT=${config.stagingRoot}`,
    ""
  ].join("\n");
}

export function environmentAction(
  source: string | null,
  content: string
): InitializerAction["action"] {
  if (source === null) {
    return "create";
  }
  return source === content ? "unchanged" : "update";
}

export function assertNoOtherOwnedIdentity(
  source: string,
  identity: string
): void {
  const owned =
    /^# Managed by mcpshell-workspace-bridge: ([A-Za-z0-9_-]+)\n\[mcp_servers\.([A-Za-z0-9_-]+)\]\n/gmu;
  for (const match of source.matchAll(owned)) {
    const markerIdentity = match[1];
    const tableIdentity = match[2];
    if (
      markerIdentity !== undefined &&
      markerIdentity === tableIdentity &&
      markerIdentity !== identity
    ) {
      throw new BridgeError(
        "config_invalid",
        `config_conflict: ${tableHeader(markerIdentity)} is already managed by this bridge`
      );
    }
  }
}
