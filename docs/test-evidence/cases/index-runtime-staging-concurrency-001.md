### Case INDEX-RUNTIME-STAGING-CONCURRENCY-001: 注入仓储映射竞争中的 Pending 替换冲突

Tests:
- `test:0c8cc61716e15b079f1b92e2e7028e3c0530b3d507168e6dec94ab01691e9b2d`

Tags:
- `index-runtime`

Contract:
- 注入的 repository 边界拒绝竞争替换时，staging 必须把冲突映射为稳定的 pending 诊断，不得隐式合并目标。

Proves:
- 注入仓储只接受第一个竞争替换时，两个并发调用恰有一个成功，另一个返回 `pending-conflict`。
- 暂存索引只采用获胜调用选中的变更；另一调用选中的条目保留 revision 状态，不包含两个调用的隐式合并。
