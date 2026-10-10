"""从仓库根重放两个只读快照查询，计数 readFile 而保留原返回值。

python3 docs/investigations/_resources/261010-investigation-acquisition-performance-recheck/measure-snapshot-query-access.py
观测器及结果仅在自动清理的临时目录；不改工作区或 pending。
"""
import json
import os
from pathlib import Path
import subprocess
import tempfile

COUNTER = r'''
import fs from "node:fs";
import promises from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
const paths = new Set(JSON.parse(process.env.AUDIT_FORMAL_PATHS));
const counts = { formalReadFile: 0, distinctFormalFiles: 0 };
const seen = new Set();
const original = promises.readFile;
promises.readFile = function(...args) {
  if (paths.has(String(args[0]))) {
    counts.formalReadFile += 1;
    seen.add(String(args[0]));
  }
  return original.apply(this, args);
};
syncBuiltinESMExports();
process.on("exit", () => {
  counts.distinctFormalFiles = seen.size;
  fs.writeFileSync(process.env.AUDIT_FS_OUTPUT + "." + process.pid + ".json", JSON.stringify(counts));
});
'''


def main():
    root = Path.cwd()
    directory = root / "docs/investigations"
    index = json.loads((directory / "investigation-index.json").read_text())
    paths = [str(directory / entry["sourcePath"]) for entry in index["entries"].values()]
    with tempfile.TemporaryDirectory(prefix="investigation-snapshot-audit-") as temporary:
        base = Path(temporary)
        counter = base / "counter.mjs"
        counter.write_text(COUNTER)
        for sequence, arguments in enumerate([["list", "--limit", "1"], ["search", "Git", "--in", "metadata", "--limit", "1"]]):
            output = base / str(sequence)
            environment = dict(os.environ, AUDIT_FORMAL_PATHS=json.dumps(paths), AUDIT_FS_OUTPUT=str(output))
            environment["NODE_OPTIONS"] = (environment.get("NODE_OPTIONS", "") + " --import=" + str(counter)).strip()
            result = subprocess.run(["bun", "run", "investigation-report", "--", *arguments], cwd=root, env=environment, capture_output=True, text=True)
            if result.returncode != 0:
                raise RuntimeError(result.stderr)
            counts = {"formalReadFile": 0, "distinctFormalFiles": 0}
            for item in base.glob(str(sequence) + ".*.json"):
                for key, value in json.loads(item.read_text()).items():
                    counts[key] += value
            print(json.dumps({"arguments": arguments, "published_report_count": len(paths), "filesystem": counts, "exit": result.returncode}), flush=True)


if __name__ == "__main__":
    main()
