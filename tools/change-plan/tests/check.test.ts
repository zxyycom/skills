import test from "node:test";
import { withFileSystemRoot, withTempRoot } from "./support.ts";

import {
  testStageArtifactContracts,
  testValidPlan
} from "./check-contracts.test.ts";
import {
  testActiveMetadataBoundaries,
  testVersionControlFailure
} from "./check-metadata.test.ts";
import {
  testArtifactDiagnostics,
  testDirectoryDiagnostics
} from "./check-diagnostics.test.ts";
import { testSymbolicLinkDiagnostics } from "./check-symlinks.test.ts";

test("check accepts a complete plan", () =>
  withTempRoot("check-valid", testValidPlan));

test("check applies stage-specific artifact contracts", () =>
  withFileSystemRoot("check-stages", testStageArtifactContracts));

test("check validates active metadata", () =>
  withFileSystemRoot("check-metadata", testActiveMetadataBoundaries));

test("check reports change directory path diagnostics", () =>
  withFileSystemRoot("check-paths", testDirectoryDiagnostics));

test("check reports proposal and task artifact diagnostics", () =>
  withFileSystemRoot("check-artifacts", testArtifactDiagnostics));

test("check reports version-control failures separately from unavailable baselines", () =>
  withTempRoot("check-version-control", testVersionControlFailure));

test("check rejects symbolic-link change directories and artifacts", () =>
  withFileSystemRoot("check-symbolic-links", testSymbolicLinkDiagnostics));
