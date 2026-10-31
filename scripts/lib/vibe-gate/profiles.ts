import { gateToolInputs, type GateToolId } from "./impact-tools.ts";

export const gateScopes = [
  "quick",
  "selected",
  "changed",
  "full",
  "release"
] as const;
export type GateScope = (typeof gateScopes)[number];

export function isGateScope(value: string | undefined): value is GateScope {
  return gateScopes.some((scope) => scope === value);
}

export function isGateSelectionScope(
  value: string | undefined
): value is GateToolId {
  return value !== undefined && Object.hasOwn(gateToolInputs, value);
}

export const gateSelectionScopes =
  Object.keys(gateToolInputs).filter(isGateSelectionScope);

// 按证明责任固定必要集，不按历史耗时动态增删。
export const quickGateCheckIds = [
  "gate-environment",
  "secret-detection",
  "json-validation",
  "json-schema-validation",
  "markdown-link-validation",
  "markdown-lint"
] as const;

export function isQuickGateCheck(checkId: string): boolean {
  return quickGateCheckIds.some((candidate) => candidate === checkId);
}

// 只作为 quick Definition 中不适用成员的原生条件，CLI 永不激活。
export const outsideQuickScopeFlag = "gate-scope:outside-quick";
