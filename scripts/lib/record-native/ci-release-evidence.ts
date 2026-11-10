import * as v from "valibot";

const digest = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/));
const fileList = v.strictObject({ sha256: digest, files: v.array(v.string()) });
const evidence = v.strictObject({
  revision: v.pipe(v.string(), v.regex(/^[a-f0-9]{40,64}$/)),
  versions: v.tuple([
    v.pipe(v.string(), v.regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/))
  ]),
  delivery: fileList,
  sources: v.tuple([fileList])
});

/** The two platforms must have compiled exactly the same pending inputs. */
export function compareReleaseEvidence(linux: unknown, windows: unknown): void {
  const a = v.parse(evidence, linux);
  const b = v.parse(evidence, windows);
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error("formal platform revision or frozen inputs differ");
}
