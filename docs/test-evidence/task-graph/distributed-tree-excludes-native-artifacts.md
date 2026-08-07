### Case TASK-GRAPH-DISTRIBUTION-PACKAGE-001: skill 树不携带 runtime 或安装产物

Entry:
- `tools/task-graph/tests/generated-artifacts.test.ts > distributed task-graph tree contains no native runtime or install artifacts`
- `bun test --test-name-pattern="^distributed task-graph tree contains no native runtime or install artifacts$" ./tools/task-graph/tests/run.ts`

Contract:
- Skill 分发只提供 runtime 探测与安装 argv，不包含 runtime manifest、npm lockfile、`.node`、npm cache 或 `.install-*`。

Proves:
- 递归检查 task-graph skill 树确认 runtime 资产目录、native 二进制与安装期路径全部缺失。
