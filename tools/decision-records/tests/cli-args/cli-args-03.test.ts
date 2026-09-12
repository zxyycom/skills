import { assert, currentRelativePath, runCli, test } from "./support.ts";

test("evolve relation groups reject incomplete and mixed relation input before scanning", async () => {
  for (const { args, message } of [
    {
      args: [
        "evolve",
        "--successor",
        "aligned=use-successor",
        "--relation",
        "修订=" + currentRelativePath,
        "--relations-for",
        "use-successor",
        "--relation",
        "修订=" + currentRelativePath
      ],
      message: /must follow --relations-for/
    },
    {
      args: [
        "evolve",
        "--successor",
        "aligned=use-successor",
        "--relations-for",
        "use-successor"
      ],
      message: /requires at least one --relation or --clear-relations/
    },
    {
      args: [
        "evolve",
        "--successor",
        "aligned=use-successor",
        "--relations-for",
        "use-successor",
        "--clear-relations",
        "--relation",
        "修订=" + currentRelativePath
      ],
      message: /cannot be used with --relation/
    }
  ] as const) {
    const result = await runCli(args);
    assert.equal(result.exitCode, 2, args.join(" "));
    assert.equal(result.stdout, "", args.join(" "));
    assert.match(result.stderr, message, args.join(" "));
  }
});

test("evolve relation groups reject repeated raw sources and targets", async () => {
  for (const { args, message } of [
    {
      args: [
        "--relations-for",
        "use-successor",
        "--relation",
        "修订=" + currentRelativePath,
        "--relations-for",
        "use-successor.md",
        "--relation",
        "修订=" + currentRelativePath
      ],
      message: /must not repeat a successor Decision selector/
    },
    {
      args: [
        "--relations-for",
        "use-successor",
        "--relation",
        "修订=" + currentRelativePath,
        "--relation",
        "替代=" + currentRelativePath
      ],
      message: /must not repeat a direct predecessor target/
    }
  ] as const) {
    const result = await runCli([
      "evolve",
      "--successor",
      "aligned=use-successor",
      ...args
    ]);
    assert.equal(result.exitCode, 2, args.join(" "));
    assert.equal(result.stdout, "", args.join(" "));
    assert.match(result.stderr, message, args.join(" "));
  }
});
