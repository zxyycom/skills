### Case INVESTIGATION-RELATION-GRAPH-TRACE-001: Investigation Trace 选择确定的受限关系切片

Tests:
- `test:0986f9eaba0888845955837bf097d00c9fb40955e5e676587047fa6da3c6ac42`
- `test:8d2a2f958b392bf72edd8ae2c91fc37e72c044874672a617b47e8fd31cb89941`
- `test:a043608195e6b7d156792da94950d85fba258e17c3f892fd243667177f0ba02a`

Tags:
- `investigation-report`

Contract:
- Investigation Trace 从同一报告状态快照选择前序、后继或双向成员；完整拆分和纯归并事件原子闭合，depth 与记录预算显式表达覆盖边界。

Proves:
- 各方向、双向和 depth 0 返回确定的 traceIds、contextIds、entries 与 frontier。
- 拆分和纯归并把非直接成员作为非递归 context，直到真实直接到达才提升。
- 放不下完整拆分时只保留 anchor，并返回完整 blockedEvent 与 requiredMaxRecords。
