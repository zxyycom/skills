import type { StateIndexKeyScalar } from "./types.ts";

export function compareIndexText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

export function compareStateIndexKeyScalars(
  left: StateIndexKeyScalar,
  right: StateIndexKeyScalar
): number {
  const leftOrder = scalarTypeOrder(left);
  const rightOrder = scalarTypeOrder(right);
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  if (typeof left === "boolean" && typeof right === "boolean") {
    return Number(left) - Number(right);
  }
  return compareIndexText(String(left), String(right));
}

export function compareDefinitionKeyNames(
  left: string,
  right: string,
  order: ReadonlyMap<string, number>
): number {
  const leftOrder = order.get(left) ?? Number.POSITIVE_INFINITY;
  const rightOrder = order.get(right) ?? Number.POSITIVE_INFINITY;
  return leftOrder === rightOrder
    ? compareIndexText(left, right)
    : leftOrder - rightOrder;
}

function scalarTypeOrder(value: StateIndexKeyScalar): number {
  switch (typeof value) {
    case "boolean":
      return 0;
    case "number":
      return 1;
    case "string":
      return 2;
  }
}
