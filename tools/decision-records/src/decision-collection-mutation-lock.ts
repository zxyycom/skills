import fs from "node:fs/promises";
import path from "node:path";

export async function withDecisionCollectionMutationLock<Result>(
  indexPath: string,
  operation: () => Promise<Result>
): Promise<Result> {
  const lockPath = path.join(
    path.dirname(path.dirname(indexPath)),
    `.${path.basename(indexPath)}.mutation.lock`
  );
  let handle: Awaited<ReturnType<typeof fs.open>>;
  try {
    handle = await fs.open(lockPath, "wx");
  } catch (error) {
    throw new Error(
      `could not acquire decision collection mutation lock ${lockPath}: ${errorText(error)}; retry after the active transaction completes`
    );
  }
  try {
    return await operation();
  } finally {
    await handle.close().catch(() => undefined);
    await fs.rm(lockPath, { force: true }).catch(() => undefined);
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
