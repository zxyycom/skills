import { decisionFileSystemErrorText } from "./application-result.ts";

export function addCollectionError(
  collectionErrors: string[],
  sourceErrors: string[],
  error: string
): void {
  collectionErrors.push(error);
  sourceErrors.push(error);
}

export function errorText(error: unknown): string {
  return decisionFileSystemErrorText(error);
}
