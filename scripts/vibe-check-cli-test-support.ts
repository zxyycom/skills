import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { defineCheck, defineConfig, run } from "@zxyycom/vibe-check";
import type { ProjectDefinition, RunControls } from "@zxyycom/vibe-check";
import type { GateInvocation, VibeCheckDependencies } from "./vibe-check.ts";
import { aggregateOptions, noOutput } from "./vibe-check-test-support.ts";

export type CliCapture = {
  diagnostics: string[];
  information: string[];
  selectedInvocation: GateInvocation | null;
};

export function passedDefinition(): ProjectDefinition {
  return defineConfig({
    checks: [
      defineCheck({
        checkId: "passed",
        displayName: "passed",
        execution: () => ({ status: "passed" as const, data: { value: true } })
      })
    ],
    outputs: noOutput
  });
}

export function failedDefinition(): ProjectDefinition {
  return defineConfig({
    checks: [
      defineCheck({
        checkId: "failed",
        displayName: "failed",
        execution: () => ({ status: "failed" as const, data: { value: false } })
      })
    ],
    outputs: noOutput
  });
}

export function invalidDefinition(): ProjectDefinition {
  return defineConfig({
    checks: [
      defineCheck({
        checkId: "duplicate",
        displayName: "first duplicate",
        execution: () => ({ status: "passed" as const, data: {} })
      }),
      defineCheck({
        checkId: "duplicate",
        displayName: "second duplicate",
        execution: () => ({ status: "passed" as const, data: {} })
      })
    ],
    outputs: noOutput
  });
}

export function unknownDependencyDefinition(): ProjectDefinition {
  return defineConfig({
    checks: [
      defineCheck({
        checkId: "consumer",
        dependsOn: ["missing-prerequisite"],
        displayName: "consumer with an unknown prerequisite",
        execution: () => ({ status: "passed" as const, data: {} })
      })
    ],
    outputs: noOutput
  });
}

export function createCliCapture(): CliCapture {
  return { diagnostics: [], information: [], selectedInvocation: null };
}

export function capturedCliDependencies(
  capture: CliCapture,
  definition: ProjectDefinition = passedDefinition()
): VibeCheckDependencies {
  return {
    createInvocationDirectory: () =>
      path.join(os.tmpdir(), `skills-vibe-cli-${process.pid}-${randomUUID()}`),
    createDefinition(invocation) {
      capture.selectedInvocation = invocation;
      return definition;
    },
    prepareActivation: false,
    reportError: (message) => capture.diagnostics.push(message),
    reportInfo: (message) => capture.information.push(message),
    async runProject(selectedDefinition, controls) {
      return await run(selectedDefinition, {
        ...controls,
        checkAggregation: aggregateOptions
      });
    }
  };
}

export async function runInProject(
  definition: ProjectDefinition,
  controls: RunControls,
  projectRoot: string
) {
  return await run(definition, {
    ...controls,
    checkAggregation: aggregateOptions,
    projectRoot
  });
}
