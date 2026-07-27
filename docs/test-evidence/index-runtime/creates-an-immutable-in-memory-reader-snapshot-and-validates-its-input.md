### Case INDEX-RUNTIME-READER-001: 创建不可变内存 reader 快照并验证输入
Entry:
- `tools/index-runtime/tests/runtime.test.ts > creates an immutable in-memory reader snapshot and validates its input`
- `bun test --test-name-pattern="^creates an immutable in-memory reader snapshot and validates its input$" ./tools/index-runtime/tests/run.ts`
Contract:
- 内存 reader 必须复制并冻结有效索引，拒绝定义不匹配或结构畸形输入。
Proves:
- 创建后修改输入不影响查询，错误键定义和空条目分别触发稳定错误。
