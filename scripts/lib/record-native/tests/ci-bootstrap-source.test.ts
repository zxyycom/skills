import assert from "node:assert/strict";
import { test } from "node:test";
import { privateBootstrapSuccessor } from "../ci-bootstrap-source.ts";
import {
  digestNativeSource,
  type NativeCandidateSnapshot
} from "../capture.ts";

function fixture(): NativeCandidateSnapshot {
  const source = [
    {
      path: "Cargo.toml",
      data: Buffer.from('[package]\nname = "record-cli"\nversion = "0.1.0"\n')
    },
    {
      path: "Cargo.lock",
      data: Buffer.from('name = "record-cli"\nversion = "0.1.0"\n')
    }
  ];
  const filesBySkill = new Map(
    ["decision-records", "investigation-report"].map((name, i) => [
      name,
      [
        {
          path: "SKILL.md",
          data: Buffer.from(
            `---\nname: ${name}\nmetadata:\n  version: "${i ? 98 : 109}"\n---\n`
          )
        }
      ]
    ])
  );
  return {
    source,
    sourceHash: digestNativeSource(source),
    delivery: [],
    deliveryHash: digestNativeSource([]),
    skills: {
      skills: [...filesBySkill.keys()].map((name) => ({
        name,
        directory: name
      })),
      filesBySkill
    }
  };
}

test("private bootstrap successor changes only the explicit Rust and skill versions", () => {
  const a = fixture();
  const b = privateBootstrapSuccessor(a);
  assert.notEqual(a.sourceHash, b.sourceHash);
  assert.equal(
    b.source[0]?.data.toString(),
    '[package]\nname = "record-cli"\nversion = "0.1.1"\n'
  );
  assert.match(
    b.skills.filesBySkill.get("decision-records")![0]!.data.toString(),
    /version: "110"/
  );
  assert.match(
    b.skills.filesBySkill.get("investigation-report")![0]!.data.toString(),
    /version: "99"/
  );
  assert.match(a.source[0]!.data.toString(), /0\.1\.0/);
  assert.match(
    a.skills.filesBySkill.get("decision-records")![0]!.data.toString(),
    /version: "109"/
  );
  const bad = {
    ...a,
    source: [{ path: "Cargo.toml", data: Buffer.from("wrong") }, a.source[1]!]
  };
  assert.throws(
    () => privateBootstrapSuccessor(bad),
    /invalid successor source/
  );
});
