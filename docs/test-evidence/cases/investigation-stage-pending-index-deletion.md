### Case INVESTIGATION-STAGE-PENDING-INDEX-DELETION-001: 拒绝以已删除的 pending 索引组合

Tests:
- `test:377f869a34af709f3f1366295acf1d3e0190cb773fe725973ce69f242045e849`
- `test:a922ab01cf4dbcc8346297d66392fa2dd18a8caf226b9994394f524b9ff42f77`

Tags:
- `investigation-report`

Contract:
- index scope 不得从 HEAD 重建已在 pending 删除的索引。

Proves:
- Decision definition 的真实 Git fixture 在 HEAD 有索引而 pending 删除时，共享 stage_index 返回失败，pending 全部 entries 与工作区索引字节不变。
- IR definition 的独立真实 Git fixture 调用同一 stage_index，所选投影刷新并保留未选 pending；本 Case 组合共享失败分支与 IR 接线证据，不宣称执行了 IR 删除故障 fixture。
