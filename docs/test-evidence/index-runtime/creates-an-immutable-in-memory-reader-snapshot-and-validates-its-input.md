### Case INDEX-RUNTIME-READER-001: 创建不可变内存 reader 快照并验证输入
Entry:
- `tools/index-runtime/tests/runtime.test.ts > creates an immutable in-memory reader snapshot and validates its input`
- `bun test --test-name-pattern="^creates an immutable in-memory reader snapshot and validates its input$" ./tools/index-runtime/tests/run.ts`
Contract:
- 内存 reader 必须严格解析、复制并冻结有效 state-only 索引，拒绝 definition identity 不匹配或结构畸形输入。
Proves:
- 创建后修改 metadata、删除 keyed entry 或改写直接 state 均不影响查询；公开 reader entry 只包含 `id` 与 `state`；错误 definition version 与非对象 entries 分别触发稳定错误。
