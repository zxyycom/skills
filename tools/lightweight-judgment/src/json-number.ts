import { fail, type FailureKind } from "./failure.ts";

function normalizedDecimal(source: string): string {
  const [mantissa, exponent = "0"] = source.toLowerCase().split("e");
  const parts = mantissa!.split(".");
  let digits = parts.join("").replace(/^(-?)0+/u, "$1");
  let power = Number(exponent) - (parts[1]?.length ?? 0);
  if (!Number.isSafeInteger(power)) {
    return "out-of-range";
  }
  while (digits.endsWith("0") && digits !== "0") {
    digits = digits.slice(0, -1);
    power++;
  }
  if (digits === "" || digits === "-") {
    return "0";
  }
  return `${digits}e${power}`;
}

export function parseNumber(
  token: string,
  kind: FailureKind,
  path: string
): number {
  const parsed = Number(token);
  if (!Number.isFinite(parsed)) {
    fail(kind, path, "数值不是有限数值");
  }
  if (Number.isInteger(parsed) && !Number.isSafeInteger(parsed)) {
    fail(kind, path, "整数超出安全范围");
  }
  if (parsed === 0 && /[1-9]/u.test(token.split(/[eE]/u)[0]!)) {
    fail(kind, path, "数值下溢");
  }
  if (Object.is(parsed, -0)) {
    fail(kind, path, "负零不能无损传输，请使用字符串保存");
  }
  if (normalizedDecimal(token) !== normalizedDecimal(JSON.stringify(parsed))) {
    fail(kind, path, "数值不能无损往返，请使用字符串保存精确数值");
  }
  return parsed;
}
