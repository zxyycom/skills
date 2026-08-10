import { runTestEvidenceLedgerCli } from "../src/ledger/cli.ts";

process.exitCode = await runTestEvidenceLedgerCli(process.argv.slice(2));
