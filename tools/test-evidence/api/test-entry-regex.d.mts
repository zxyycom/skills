import type { RegexCollectorConfig } from "./regex-collector-config.types.mjs";
import type { TestEntryInventory } from "./test-entry-inventory.types.mjs";

export type StandardOutputSchema<T> = {
  readonly "~standard": {
    readonly types?: { readonly input: unknown; readonly output: T };
    readonly validate: (value: unknown) => unknown;
  };
};

export type CollectRegexTestEntriesOptions = {
  config?: unknown;
  configPath?: string;
  workspaceRoot: string;
};

export type RegexDetector = NonNullable<RegexCollectorConfig["patterns"]>[number];
export type TestEntry = TestEntryInventory["entries"][number];
export type TestEntryMarker = TestEntryInventory["markers"][number];
export type TestEvidenceDiagnostic = TestEntryInventory["diagnostics"][number];

export type { RegexCollectorConfig, TestEntryInventory };

export declare const regexCollectorConfigSchema: StandardOutputSchema<unknown>;
export declare const regexDetectorSchema: StandardOutputSchema<unknown>;
export declare const testEntryInventorySchema: StandardOutputSchema<TestEntryInventory>;

export declare function collectRegexTestEntries(
  options: CollectRegexTestEntriesOptions
): Promise<TestEntryInventory>;

export declare function runRegexCollectorCli(
  argv?: readonly string[]
): Promise<number>;
