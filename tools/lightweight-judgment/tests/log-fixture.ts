import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { CliRuntime } from "../src/cli.ts";
import { runtime } from "./runtime-fixture.ts";

export function logFixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "judgment-calls-"));
  const databasePath = path.join(directory, "calls.sqlite3");
  return {
    directory,
    databasePath,
    runtime(
      logging: Readonly<Record<string, unknown>> = {},
      overrides: Partial<CliRuntime> = {}
    ): CliRuntime {
      return runtime({
        home: directory,
        readFile: async () =>
          JSON.stringify({
            logging: { enabled: true, databasePath, ...logging }
          }),
        ...overrides
      });
    },
    cleanup: () => fs.rmSync(directory, { recursive: true, force: true })
  };
}

export function rows(
  file: string
): readonly Readonly<Record<string, unknown>>[] {
  const database = new DatabaseSync(file, { readOnly: true });
  try {
    return database
      .prepare("SELECT * FROM calls ORDER BY started_at, id")
      .all()
      .map((row) => ({ ...row }));
  } finally {
    database.close();
  }
}
