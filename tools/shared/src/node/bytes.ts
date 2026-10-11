import { Buffer } from "node:buffer";

/** Compare views without allocating copies of their backing payloads. */
export function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return Buffer.from(left.buffer, left.byteOffset, left.byteLength).equals(
    Buffer.from(right.buffer, right.byteOffset, right.byteLength)
  );
}
