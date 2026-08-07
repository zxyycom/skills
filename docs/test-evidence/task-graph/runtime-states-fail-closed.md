### Case TASK-GRAPH-RUNTIME-STATE-001: missing 与 incompatible runtime 不被自动修复

Entry:
- `tools/task-graph/tests/runtime.test.ts > runtime missing and incompatible states fail closed`
- `bun test --test-name-pattern="^runtime missing and incompatible states fail closed$" ./tools/task-graph/tests/run.ts`

Contract:
- 缺失 runtime 返回安装 argv；已有目录的直接包版本或 API 不兼容时返回诊断并原样保留。

Proves:
- info 区分 missing/incompatible，mutation binding 分别返回 `RUNTIME_MISSING` 与 `RUNTIME_INCOMPATIBLE`；错误版本没有安装指令，也不被删除。
