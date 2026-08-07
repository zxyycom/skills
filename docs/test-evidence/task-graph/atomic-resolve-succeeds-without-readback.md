### Case TASK-GRAPH-ATOMIC-RESOLVE-001: atomic resolve 后不执行提交读回

Entry:
- `tools/task-graph/tests/store.test.ts > resolved atomic write succeeds without commit readback`
- `bun test --test-name-pattern="^resolved atomic write succeeds without commit readback$" ./tools/task-graph/tests/run.ts`

Contract:
- `write-file-atomic` resolve 是提交调用成功边界；task-graph 不以额外文件读取重新判定该结果。

Proves:
- 测试 writer 删除索引后 resolve，mutation 仍只调用 writer 一次并返回候选 revision，证明没有提交读回。
