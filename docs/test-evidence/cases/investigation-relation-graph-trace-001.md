### Case INVESTIGATION-RELATION-GRAPH-TRACE-001: Investigation Trace 选择确定的受限关系切片

Tests:
- `test:0c00a2ec0fd7ebedc23244e3f4d8594b547144cf3a5e104b9e3d1f1b002ba907`
- `test:b991286662d32937dc0356b3ad1463f714042d022f0abb0c41f443adfa7d94c7`
- `test:d2b19d91cd532538bfee7d4123c87d980eac1ecced9f58479c4d541d9a3fd280`

Tags:
- `investigation-report`

Contract:
- Investigation Trace 从同一报告状态快照选择前序、后继或双向成员；完整拆分和纯归并事件原子闭合，depth 与记录预算显式表达覆盖边界。

Proves:
- 各方向、双向和 depth 0 返回确定的 traceIds、contextIds、entries 与 frontier。
- 拆分和纯归并把非直接成员作为非递归 context，直到真实直接到达才提升。
- 放不下完整拆分时只保留 anchor，并返回完整 blockedEvent 与 requiredMaxRecords。
