"""重放当前工作区生成 CLI 的进程与文件读取计数，每项操作输出一行 JSON。

从仓库根运行：
python3 docs/investigations/_resources/261009-skill-cli-repeated-process-and-source-access/measure-process-access.py --count 1 --count 20

每个 formal 样本依次输出局部 check、全量 check、fileMode=true stage、
fileMode=false stage。全部创建、提交与暂存操作位于自动清理的隔离目录；
历史版本与观测见同目录 observations.json，单次耗时仅供观察。
"""

import argparse
import collections
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time


FS_COUNTER = r'''
import fs from "node:fs";
import promises from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
const counts = { readFile: 0, candidateReadFile: 0 };
const original = promises.readFile;
promises.readFile = function(...args) {
  const target = String(args[0]);
  if (target.includes(process.env.AUDIT_FS_SCOPE)) {
    counts.readFile += 1;
    if (target.split("/").at(-1).startsWith("_candidate."))
      counts.candidateReadFile += 1;
  }
  return original.apply(this, args);
};
syncBuiltinESMExports();
process.on("exit", () => fs.writeFileSync(
  process.env.AUDIT_FS_OUTPUT + "." + process.pid + ".json",
  JSON.stringify(counts)
));
'''


def run(command, workspace, environment=None):
    result = subprocess.run(
        command, cwd=workspace, env=environment, capture_output=True, text=True
    )
    if result.returncode != 0:
        raise RuntimeError(f"Command failed: {command}\n{result.stderr}")
    return result


def cli(workspace, skill, root, arguments, observation=None, sample_size=None):
    environment = dict(os.environ)
    if observation is not None:
        trace = observation / "git.jsonl"
        environment.update(
            GIT_TRACE2_EVENT=str(trace),
            AUDIT_FS_OUTPUT=str(observation / "fs"),
            AUDIT_FS_SCOPE=f"/docs/{'decisions' if skill == 'decision-records' else 'investigations'}/",
            NODE_OPTIONS=(
                environment.get("NODE_OPTIONS", "")
                + " --import=" + str(observation.parent / "counter.mjs")
            ).strip(),
        )
    start = time.perf_counter()
    result = run(
        ["bun", "run", skill, "--", "--root", str(root), *arguments],
        workspace, environment,
    )
    if observation is None:
        return
    elapsed = round((time.perf_counter() - start) * 1000)
    events = [json.loads(line) for line in trace.read_text().splitlines()] if trace.exists() else []
    starts = [event for event in events if event["event"] == "start"]
    commands = collections.Counter()
    for event in starts:
        argv = event["argv"]
        commands[argv[3] if argv[1] == "-C" else argv[1]] += 1
    filesystem = collections.Counter()
    for output in observation.glob("fs.*.json"):
        filesystem.update(json.loads(output.read_text()))
    print(json.dumps({
        "skill": skill, "command": arguments[0], "sample_size": sample_size, "fixture": root.name,
        "git_calls": len(starts), "commands": dict(commands),
        "filesystem": dict(filesystem), "elapsed_single_ms": elapsed,
        "exit": result.returncode,
    }, ensure_ascii=False), flush=True)


def fixture(workspace, root, count, kind, resources=True):
    decisions = kind == "decisions"
    directory = root / "docs" / ("decisions" if decisions else "investigations")
    directory.mkdir(parents=True)
    ids = []
    for number in range(1, count + 1):
        name = f"audit-{number:03}"
        identity = f"261009-{name}"
        ids.append(identity)
        if decisions:
            text = f'''---
title: "隔离样本 {number}"
id: "{identity}"
status: active
alignment: aligned
createdAt: 2026-10-09T00:00:00Z
purpose: 核对进程计数。
background: 隔离样本。
decision: 仅作计数样本。
tags:
  - process-audit
relations: []
---

## 目的
计数。
## 背景
隔离样本。
## 决策
- 采用：计数样本。
'''
        else:
            text = f'''---
title: "隔离样本 {number}"
id: "{identity}"
formedAt: "2026-10-09T00:00:00Z"
question: "资源检查如何调用 Git？"
tags:
  - "process-audit"
relations: []
---

## 形成时背景
隔离样本。
## 调查目的
计数。
## 调查范围与依据
当前 CLI。
## 调查结果与边界
仅作样本。
'''
            if resources:
                resource = directory / "_resources" / identity / "sample.txt"
                resource.parent.mkdir(parents=True)
                resource.write_text("process audit sample\n")
                text += f"\n## 随附资源\n- [样本](./_resources/{identity}/sample.txt)\n"
        filename = f"_candidate.{name}" if kind == "candidates" else f"{name}.md"
        (directory / filename).write_text(text)
    run(["git", "init", "-q", str(root)], workspace)
    run(["git", "-C", str(root), "config", "core.fileMode", "true"], workspace)
    if kind != "candidates":
        cli(workspace, "decision-records" if decisions else "investigation-report", root, ["sync-index"])
    run(["git", "-C", str(root), "add", "--", "docs"], workspace)
    environment = dict(os.environ, GIT_AUTHOR_NAME="Fixture", GIT_AUTHOR_EMAIL="fixture@example.invalid",
                       GIT_COMMITTER_NAME="Fixture", GIT_COMMITTER_EMAIL="fixture@example.invalid")
    run(["git", "-C", str(root), "-c", "core.hooksPath=/dev/null", "-c", "commit.gpgSign=false",
         "commit", "-q", "-m", "isolated process audit fixture"], workspace, environment)
    return ids


def main():
    parser = argparse.ArgumentParser(description="重放计数；100 条候选可能耗时一分钟以上。需要项目 Bun、Node、Git 和 Python。")
    parser.add_argument("--workspace", type=Path, default=Path.cwd())
    parser.add_argument("--count", type=int, action="append", help="样本条数，可重复；默认 1 和 20，范围 1–100。")
    arguments = parser.parse_args()
    counts = arguments.count or [1, 20]
    if any(count < 1 or count > 100 for count in counts):
        parser.error("count must be between 1 and 100")
    workspace = arguments.workspace.resolve()
    if not (workspace / "package.json").is_file():
        parser.error("workspace must be this repository root")
    with tempfile.TemporaryDirectory(prefix="skill-process-audit-") as temporary:
        base = Path(temporary)
        (base / "counter.mjs").write_text(FS_COUNTER)
        sequence = 0

        def measure(skill, root, command):
            nonlocal sequence
            observation = base / f"observation-{sequence}"
            observation.mkdir()
            sequence += 1
            cli(workspace, skill, root, command, observation, count)

        for count in counts:
            for resources in [True, False]:
                root = base / f"candidates-{count}-{resources}"
                fixture(workspace, root, count, "candidates", resources)
                measure("investigation-report", root, ["candidates"])
            root = base / f"formal-{count}"
            ids = fixture(workspace, root, count, "formal")
            measure("investigation-report", root, ["check", *[arg for identity in ids for arg in ["--id", identity]]])
            measure("investigation-report", root, ["check"])
            measure("investigation-report", root, ["stage", *ids, "--scope", "domain"])
            run(["git", "-C", str(root), "config", "core.fileMode", "false"], workspace)
            measure("investigation-report", root, ["stage", *ids, "--scope", "domain"])
            root = base / f"decisions-{count}"
            ids = fixture(workspace, root, count, "decisions")
            measure("decision-records", root, ["stage", *ids, "--scope", "domain"])
            measure("decision-records", root, ["archive", *ids])


if __name__ == "__main__":
    main()
