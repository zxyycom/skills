import path from "node:path";
import { captureNativeCandidateSnapshot } from "../lib/record-native/capture.ts";
import { stageNativeCandidateInputs } from "../lib/record-native/staging.ts";
import { generatePrivateNativeCandidate } from "../lib/record-native/candidate-generate.ts";
import { writeCandidateSourcePackages } from "../lib/record-native/candidate-package.ts";

const [runtimeVersion, modules, ...extra] = process.argv.slice(2);
if (
  !runtimeVersion ||
  !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(runtimeVersion) ||
  !modules ||
  extra.length
) {
  console.error(
    "Usage: node scripts/build/native-record-candidate.ts <runtime-version> <prepared-node-modules-directory>"
  );
  process.exitCode = 1;
} else {
  try {
    const root = process.cwd();
    const snapshot = await captureNativeCandidateSnapshot(root);
    const stage = await stageNativeCandidateInputs(root, snapshot);
    console.log(`Private frozen candidate stage: ${stage}`);
    const inputs = await generatePrivateNativeCandidate(
      stage,
      snapshot,
      runtimeVersion,
      path.resolve(modules)
    );
    const output = await writeCandidateSourcePackages(stage, inputs);
    console.log(
      `Private source packages: ${output}\nThese are not platform or installation acceptance evidence.`
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
