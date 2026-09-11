import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  duplicateDetection,
  jsonSchemaValidation,
  jsonValidation,
  markdownLinkValidation,
  secretDetection
} from "@zxyycom/vibe-check";
import { assertNativeBlockingCheckContract } from "./vibe-check-test-support.ts";

test("duplicate detection blocks findings and fails closed when unavailable", async () => {
  const duplicatedSource = [
    "export function fixture(value: number): number {",
    "  const alpha = value + 1;",
    "  const beta = alpha + 2;",
    "  const gamma = beta + 3;",
    "  const delta = gamma + 4;",
    "  const epsilon = delta + 5;",
    "  const zeta = epsilon + 6;",
    "  const eta = zeta + 7;",
    "  const theta = eta + 8;",
    "  return theta;",
    "}",
    ""
  ].join("\n");
  await assertNativeBlockingCheckContract({
    check: duplicateDetection({
      cache: { enabled: false },
      codeAreas: {
        fixture: {
          files: {
            exclude: [],
            include: ["**/*.ts"],
            source: "git-worktree"
          },
          findingPolicy: "blocking",
          minimumLines: 2,
          minimumTokens: 10
        }
      }
    }),
    async introduceFinding(directory) {
      await fs.writeFile(
        path.join(directory, "duplicate.ts"),
        duplicatedSource,
        "utf8"
      );
    },
    prefix: "skills-vibe-duplicate-",
    async setup(directory) {
      await Promise.all([
        fs.writeFile(
          path.join(directory, "fixture.ts"),
          duplicatedSource,
          "utf8"
        ),
        fs.writeFile(
          path.join(directory, "distinct.ts"),
          "export const distinct = 1;\n",
          "utf8"
        )
      ]);
    }
  });
});

test("secret detection blocks private-key findings and fails closed when unavailable", async () => {
  const privateKey = [
    `-----BEGIN ${"PRIVATE"} KEY-----`,
    `M${"I"}${"A".repeat(192)}`,
    `-----END ${"PRIVATE"} KEY-----`,
    ""
  ].join("\n");
  await assertNativeBlockingCheckContract({
    check: secretDetection({
      files: { exclude: [], include: ["**/*.txt"], source: "git-worktree" }
    }),
    async introduceFinding(directory) {
      await fs.writeFile(path.join(directory, "private-key.txt"), privateKey);
    },
    prefix: "skills-vibe-secret-",
    async setup(directory) {
      await fs.writeFile(path.join(directory, "safe.txt"), "safe text\n");
    }
  });
});

test("JSON validation blocks findings and fails closed when unavailable", async () => {
  await assertNativeBlockingCheckContract({
    check: jsonValidation({
      files: { exclude: [], include: ["**/*.json"], source: "git-worktree" }
    }),
    async introduceFinding(directory) {
      await fs.writeFile(path.join(directory, "broken.json"), "{\n", "utf8");
    },
    prefix: "skills-vibe-json-",
    async setup(directory) {
      await fs.writeFile(
        path.join(directory, "valid.json"),
        '{"valid":true}\n',
        "utf8"
      );
    }
  });
});

test("JSON schema validation blocks findings and fails closed when unavailable", async () => {
  await assertNativeBlockingCheckContract({
    check: jsonSchemaValidation({
      bindings: [
        {
          id: "fixture",
          instancePath: "instance.json",
          schemaId: "urn:fixture:schema"
        }
      ],
      files: {
        exclude: [],
        include: ["schema.json", "instance.json"],
        source: "git-worktree"
      },
      schemaIdentity: { mode: "configuration-authoritative" },
      schemas: [{ id: "urn:fixture:schema", path: "schema.json" }]
    }),
    async introduceFinding(directory) {
      await fs.writeFile(
        path.join(directory, "instance.json"),
        '{"name":4}\n',
        "utf8"
      );
    },
    prefix: "skills-vibe-schema-",
    async setup(directory) {
      await Promise.all([
        fs.writeFile(
          path.join(directory, "schema.json"),
          JSON.stringify({
            properties: { name: { type: "string" } },
            required: ["name"],
            type: "object"
          }),
          "utf8"
        ),
        fs.writeFile(
          path.join(directory, "instance.json"),
          '{"name":"ok"}\n',
          "utf8"
        )
      ]);
    }
  });
});

test("Markdown link validation blocks findings and fails closed when unavailable", async () => {
  await assertNativeBlockingCheckContract({
    check: markdownLinkValidation({
      files: { exclude: [], include: ["**/*.md"], source: "git-worktree" },
      findingPolicy: "blocking"
    }),
    async introduceFinding(directory) {
      await fs.writeFile(
        path.join(directory, "root.md"),
        "[missing](missing.md)\n",
        "utf8"
      );
    },
    prefix: "skills-vibe-markdown-",
    async setup(directory) {
      await Promise.all([
        fs.writeFile(path.join(directory, "target.md"), "# Target\n", "utf8"),
        fs.writeFile(
          path.join(directory, "root.md"),
          "[target](target.md)\n",
          "utf8"
        )
      ]);
    }
  });
});
