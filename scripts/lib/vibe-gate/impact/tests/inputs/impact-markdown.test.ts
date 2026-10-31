import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { collectProjectFiles } from "@zxyycom/vibe-check";
import { runGit } from "../../../../../tests/gate/vibe-check-test-support.ts";
import { maintainedMarkdownFiles } from "../../impact-paths.ts";
import {
  prepareChangedFixtureActivation,
  prepareFixtureActivation,
  publishFixtureReceipts,
  publishInitialFixtureReceipts,
  withImpactFixture,
  writeImpactFixture
} from "../impact-test-support.ts";

const extraMarkdownSources = [
  "root-note.MD",
  "ignored-root.markdown",
  "extra/nested/note.mArKdOwN",
  "ignored-extra/nested/note.md"
] as const;

const markdownIgnoreRules = ".log/\nignored-root.markdown\nignored-extra/\n";

test("incremental Markdown proof routes content independently of business TypeScript", async () => {
  await withImpactFixture(async (fixture) => {
    await publishInitialFixtureReceipts(fixture);
    const warm = await prepareFixtureActivation(fixture);
    assert.equal(
      warm.decisions.find(({ checkId }) => checkId === "markdown-lint")?.action,
      "reuse"
    );
    await writeImpactFixture(
      fixture.directory,
      "tools/change-plan/src/value.ts",
      "export const value = 2;\n"
    );
    const code = await prepareFixtureActivation(fixture);
    assert.equal(
      code.decisions.find(({ checkId }) => checkId === "markdown-lint")?.action,
      "reuse"
    );
    await writeImpactFixture(
      fixture.directory,
      "docs/README.md",
      "# Changed\n"
    );
    const markdown = await prepareFixtureActivation(fixture);
    assert.ok(markdown.activeToolIds.includes("markdown-content"));
    assert.ok(markdown.activeCheckIds.includes("markdown-lint"));
  });
});

test("incremental Markdown proof acquires root extra and ignored native sources", async () => {
  await withImpactFixture(async (fixture) => {
    await writeImpactFixture(
      fixture.directory,
      ".gitignore",
      markdownIgnoreRules
    );
    await publishInitialFixtureReceipts(fixture);
    for (const source of extraMarkdownSources) {
      await writeImpactFixture(fixture.directory, source, "# Added\n");
      const added = await prepareFixtureActivation(fixture);
      assert.equal(added.kind, "incremental");
      assert.deepEqual(added.snapshot.unclassifiedPaths, []);
      assert.ok(added.snapshot.files.some((file) => file.path === source));
      assert.ok(added.activeCheckIds.includes("markdown-lint"), source);
      assert.equal(
        (await publishFixtureReceipts(fixture, added)).published,
        true
      );
      assert.equal(
        (await prepareFixtureActivation(fixture)).decisions.find(
          ({ checkId }) => checkId === "markdown-lint"
        )?.action,
        "reuse",
        source
      );
    }
  });
});

test("incremental Markdown proof invalidates modified root extra and ignored sources", async () => {
  await withImpactFixture(async (fixture) => {
    await writeImpactFixture(
      fixture.directory,
      ".gitignore",
      markdownIgnoreRules
    );
    for (const source of extraMarkdownSources) {
      const changed = await prepareChangedFixtureActivation(fixture, source);
      assert.equal(changed.kind, "incremental");
      assert.deepEqual(changed.snapshot.unclassifiedPaths, []);
      assert.ok(changed.activeCheckIds.includes("markdown-lint"), source);
    }
  });
});

test("incremental Markdown proof invalidates deleted sources absent from Git evidence", async () => {
  await withImpactFixture(async (fixture) => {
    await writeImpactFixture(
      fixture.directory,
      ".gitignore",
      markdownIgnoreRules
    );
    for (const source of extraMarkdownSources) {
      await writeImpactFixture(fixture.directory, source, "# Original\n");
      await publishFixtureReceipts(
        fixture,
        await prepareFixtureActivation(fixture)
      );
      await fs.rm(path.join(fixture.directory, source));
      const deleted = await prepareFixtureActivation(fixture);
      assert.ok(deleted.activeCheckIds.includes("markdown-lint"), source);
      assert.equal(
        (await publishFixtureReceipts(fixture, deleted)).published,
        true
      );
    }
  });
});

test("incremental Markdown proof invalidates renames and suffix changes without Git old paths", async () => {
  await withImpactFixture(async (fixture) => {
    await writeImpactFixture(
      fixture.directory,
      ".gitignore",
      ".log/\nignored-extra/\n"
    );
    for (const destination of [
      "ignored-extra/renamed.MARKDOWN",
      "ignored-extra/renamed.txt"
    ]) {
      const source = "ignored-extra/original.md";
      await writeImpactFixture(fixture.directory, source, "# Original\n");
      await publishFixtureReceipts(
        fixture,
        await prepareFixtureActivation(fixture)
      );
      await fs.rename(
        path.join(fixture.directory, source),
        path.join(fixture.directory, destination)
      );
      const renamed = await prepareFixtureActivation(fixture);
      assert.ok(renamed.activeCheckIds.includes("markdown-lint"), destination);
      assert.equal(
        (await publishFixtureReceipts(fixture, renamed)).published,
        true
      );
      await fs.rm(path.join(fixture.directory, destination));
    }
  });
});

test("incremental Markdown proof applies native exclusions without pruning common configuration", async () => {
  await withImpactFixture(async (fixture) => {
    const excluded = [
      "docs/investigations/_resources/report.md",
      "docs/investigations/_candidate.md",
      "skills/alpha/references/upstream/source.md",
      "skills/alpha/reference-original.md",
      "tools/change-plan/build/source.MD",
      "tools/change-plan/vendor/source.markdown",
      "tools/change-plan/.tmp/source.md"
    ];
    for (const source of excluded)
      await writeImpactFixture(fixture.directory, source, "# Original\n");
    await publishInitialFixtureReceipts(fixture);
    assert.deepEqual(
      collectProjectFiles({
        projectRoot: fixture.directory,
        selection: maintainedMarkdownFiles
      }),
      ["docs/README.md"]
    );
    for (const source of excluded)
      await writeImpactFixture(fixture.directory, source, "[broken]()\n");
    assert.equal(
      (await prepareFixtureActivation(fixture)).decisions.find(
        ({ checkId }) => checkId === "markdown-lint"
      )?.action,
      "reuse"
    );
    const configuration = await prepareChangedFixtureActivation(
      fixture,
      "scripts/lib/vibe-gate/checks/native.ts"
    );
    assert.ok(configuration.activeCheckIds.includes("markdown-lint"));
  });
});

test("incremental Markdown proof fingerprints selection rules package and configuration inputs", async () => {
  await withImpactFixture(async (fixture) => {
    for (const input of [
      "scripts/lib/vibe-gate/impact/impact-paths.ts",
      "scripts/lib/vibe-gate/checks/native.ts",
      "scripts/lib/vibe-gate/contracts.ts",
      "package.json",
      "pnpm-lock.yaml"
    ]) {
      const changed = await prepareChangedFixtureActivation(fixture, input);
      assert.ok(changed.activeCheckIds.includes("markdown-lint"), input);
    }
  });
});

test("incremental Markdown proof keeps deleted tracked extra documents owned but not selected", async () => {
  await withImpactFixture(async (fixture) => {
    for (const source of ["tracked-root.MD", "extra/tracked.markdown"]) {
      await writeImpactFixture(fixture.directory, source, "# Original\n");
      runGit(fixture.directory, ["add", source]);
      await publishFixtureReceipts(
        fixture,
        await prepareFixtureActivation(fixture)
      );
      await fs.rm(path.join(fixture.directory, source));
      const deleted = await prepareFixtureActivation(fixture);
      assert.equal(deleted.kind, "incremental");
      assert.deepEqual(deleted.snapshot.unclassifiedPaths, []);
      assert.ok(deleted.activeCheckIds.includes("markdown-lint"));
      assert.equal(
        (await publishFixtureReceipts(fixture, deleted)).published,
        true
      );
      assert.equal(
        (await prepareFixtureActivation(fixture)).decisions.find(
          ({ checkId }) => checkId === "markdown-lint"
        )?.action,
        "reuse"
      );
    }
  });
});

test("incremental Markdown proof does not claim excluded missing paths as source owners", async () => {
  await withImpactFixture(async (fixture) => {
    const excluded = "build/excluded.md";
    await writeImpactFixture(fixture.directory, excluded, "# Excluded\n");
    runGit(fixture.directory, ["add", excluded]);
    await fs.rm(path.join(fixture.directory, excluded));
    const unknown = await prepareFixtureActivation(fixture);
    assert.equal(unknown.kind, "incremental");
    assert.ok(unknown.snapshot.unclassifiedPaths.includes(excluded));
  });
});

test(
  "incremental Markdown proof invalidates source permission modes",
  { skip: process.platform === "win32" },
  async () => {
    await withImpactFixture(async (fixture) => {
      const source = "ignored-root.markdown";
      await writeImpactFixture(
        fixture.directory,
        ".gitignore",
        markdownIgnoreRules
      );
      await writeImpactFixture(fixture.directory, source, "# Original\n");
      const absolute = path.join(fixture.directory, source);
      await fs.chmod(absolute, 0o600);
      await publishFixtureReceipts(
        fixture,
        await prepareFixtureActivation(fixture)
      );
      await fs.chmod(absolute, 0o644);
      assert.ok(
        (await prepareFixtureActivation(fixture)).activeCheckIds.includes(
          "markdown-lint"
        )
      );
    });
  }
);

test("incremental Markdown proof invalidates a source replaced by a directory", async () => {
  await withImpactFixture(async (fixture) => {
    const source = "ignored-root.markdown";
    await writeImpactFixture(
      fixture.directory,
      ".gitignore",
      markdownIgnoreRules
    );
    await writeImpactFixture(fixture.directory, source, "# Original\n");
    await publishFixtureReceipts(
      fixture,
      await prepareFixtureActivation(fixture)
    );
    const absolute = path.join(fixture.directory, source);
    await fs.rm(absolute);
    await fs.mkdir(absolute);
    assert.ok(
      (await prepareFixtureActivation(fixture)).activeCheckIds.includes(
        "markdown-lint"
      )
    );
  });
});

test(
  "incremental Markdown proof falls back on unreadable extra source collection",
  { skip: process.platform === "win32" || process.getuid?.() === 0 },
  async () => {
    await withImpactFixture(async (fixture) => {
      await writeImpactFixture(
        fixture.directory,
        "extra/private/source.md",
        "# Private\n"
      );
      const directory = path.join(fixture.directory, "extra/private");
      await fs.chmod(directory, 0);
      try {
        const unavailable = await prepareFixtureActivation(fixture);
        assert.equal(unavailable.kind, "fallback");
        assert.match(unavailable.fallbackDetail, /extra[\\/]private/u);
        assert.ok(unavailable.activeCheckIds.includes("markdown-lint"));
      } finally {
        await fs.chmod(directory, 0o700);
      }
    });
  }
);

test(
  "incremental Markdown proof falls back on unreadable ignored source bytes",
  { skip: process.platform === "win32" || process.getuid?.() === 0 },
  async () => {
    await withImpactFixture(async (fixture) => {
      await writeImpactFixture(
        fixture.directory,
        ".gitignore",
        markdownIgnoreRules
      );
      const source = "ignored-extra/private.md";
      await writeImpactFixture(fixture.directory, source, "# Private\n");
      const absolute = path.join(fixture.directory, source);
      await fs.chmod(absolute, 0);
      try {
        const unavailable = await prepareFixtureActivation(fixture);
        assert.equal(unavailable.kind, "fallback");
        assert.match(
          unavailable.fallbackDetail,
          /ignored-extra[\\/]private.md/u
        );
        assert.ok(unavailable.activeCheckIds.includes("markdown-lint"));
      } finally {
        await fs.chmod(absolute, 0o600);
      }
    });
  }
);
