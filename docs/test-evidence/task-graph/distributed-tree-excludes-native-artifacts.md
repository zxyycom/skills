### Case TASK-GRAPH-DISTRIBUTION-PACKAGE-001: skill 树只含 runtime 文本资产而无 native 安装产物

Entry:
- `tools/task-graph/tests/generated-artifacts.test.ts > distributed task-graph tree contains text runtime assets and no native or install artifacts`
- `bun test --test-name-pattern="^distributed task-graph tree contains text runtime assets and no native or install artifacts$" ./tools/task-graph/tests/run.ts`

Contract:
- Skill 分发必须包含精确 runtime manifest/lockfile，但不得包含 `.node`、npm cache 或 `.install-*`。

Proves:
- 递归检查 task-graph skill 树确认两个文本资产存在，所有 native 与安装期路径缺失。
