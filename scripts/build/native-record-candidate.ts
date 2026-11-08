import path from "node:path";
import fs from "node:fs/promises";
import { captureNativeCandidateSnapshot } from "../lib/record-native/capture.ts";
import { stageNativeCandidateInputs } from "../lib/record-native/staging.ts";
import {
  generatePrivateNativeCandidate,
  generateFormalNativeCandidate
} from "../lib/record-native/candidate-generate.ts";
import { writeCandidateSourcePackages } from "../lib/record-native/candidate-package.ts";

const args = process.argv.slice(2);
const formal = args[0] === "--formal";
const [runtimeVersion, modules, marker, ...extra] = formal
  ? args.slice(1)
  : args;
if (
  !runtimeVersion ||
  !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(runtimeVersion) ||
  !modules ||
  extra.length ||
  (!formal && marker !== undefined) ||
  (marker !== undefined && !path.isAbsolute(marker))
) {
  console.error(
    "Usage: node scripts/build/native-record-candidate.ts [--formal] <runtime-version> <prepared-node-modules-directory> [absolute-stage-marker]"
  );
  process.exitCode = 1;
} else {
  try {
    const root = process.cwd();
    const snapshot = await captureNativeCandidateSnapshot(root);
    const stage = await stageNativeCandidateInputs(root, snapshot);
    console.log(`Private frozen candidate stage: ${stage}`);
    const inputs = await (
      formal ? generateFormalNativeCandidate : generatePrivateNativeCandidate
    )(stage, snapshot, runtimeVersion, path.resolve(modules));
    const output = await writeCandidateSourcePackages(stage, inputs);
    if (marker) await fs.writeFile(marker, `${stage}\n`, { flag: "wx" });
    console.log(
      `${formal ? "Formal snapshot" : "Private"} source packages: ${output}\nThese are not platform or installation acceptance evidence.`
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
