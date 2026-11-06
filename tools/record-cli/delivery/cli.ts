import { buildCandidate } from "./build.ts";
import { installCandidate } from "./install.ts";

async function main(args: string[]): Promise<void> {
  if (args[0] === "build" && args.length === 3) {
    process.stdout.write(
      `${await buildCandidate(args[1] ?? "", args[2] ?? "")}\n`
    );
    return;
  }
  if (args[0] === "install" && args.length === 4) {
    const changed = await installCandidate({
      source: args[1] ?? "",
      destination: args[2] ?? "",
      version: args[3] ?? "",
      onPlan: (entries) =>
        process.stdout.write(
          `planned: ${entries.map((entry) => `${entry.overwrite ? "overwrite" : "create"} ${entry.name}`).join(", ")}\n`
        )
    });
    process.stdout.write(`installed: ${changed.join(", ")}\n`);
    return;
  }
  throw new Error(
    "usage: node cli.ts build <new-dist-name> <version> | install <asset-directory> <private-fixture> <version>"
  );
}

main(process.argv.slice(2)).catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
