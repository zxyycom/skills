### Case TASK-GRAPH-ATOMIC-RESOLVE-001: atomic resolve 后不执行提交读回

Tests:
- `test:dd827de6f17b4c04970781cd941965d0d9038c90f08731f069c5c157e63e0de4`

Tags:
- `task-graph`

Contract:
- `write-file-atomic` resolve 是提交调用成功边界；task-graph 不以额外文件读取重新判定该结果。

Proves:
- 测试 writer 删除索引后 resolve，mutation 仍只调用 writer 一次并返回候选 revision，证明没有提交读回。
