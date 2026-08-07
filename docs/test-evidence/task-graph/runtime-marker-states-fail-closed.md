### Case TASK-GRAPH-RUNTIME-STATE-001: missing 与 invalid marker 不被自动修复

Entry:
- `tools/task-graph/tests/runtime.test.ts > runtime missing and invalid marker states fail closed without repair`
- `bun test --test-name-pattern="^runtime missing and invalid marker states fail closed without repair$" ./tools/task-graph/tests/run.ts`

Contract:
- 缺失 runtime 返回安装动作；无效既有目录返回 incompatible 并原样保留。

Proves:
- info 区分 missing/invalid，check 分别返回 `RUNTIME_MISSING` 与 `RUNTIME_INCOMPATIBLE`，无效 marker 不被删除。
