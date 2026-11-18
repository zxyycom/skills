export class MemoryError extends Error {}

export function fail(message: string): never {
  throw new MemoryError(message);
}
