### Case TASK-GRAPH-RUNTIME-CLOSURE-001: 缺失锁定传递包时拒绝祖先 node_modules fallback

Entry:
- `tools/task-graph/tests/runtime.test.ts > runtime rejects a missing locked transitive package instead of ancestor node_modules fallback`
- `bun test --test-name-pattern="^runtime rejects a missing locked transitive package instead of ancestor node_modules fallback$" ./tools/task-graph/tests/run.ts`

Contract:
- 加载 addon 前必须按嵌入 lockfile 校验目标 runtime 内全部非 optional 包的 realpath 与精确版本。

Proves:
- 目标 `require-addon` 被删除而祖先副本存在时，check 与 mutation 都返回 incompatible，mutation 不创建工作区目录。
