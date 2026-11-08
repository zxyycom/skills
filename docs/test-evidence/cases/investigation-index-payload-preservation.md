### Case IR-INDEX-PAYLOAD-PRESERVATION-001: 索引保留未选投影与删除

Tests:
- `test:377f869a34af709f3f1366295acf1d3e0190cb773fe725973ce69f242045e849`

Tags:
- `investigation-report`

Contract:
- index scope 只刷新所选发布投影，并保留未选 staged 删除。

Proves:
- 真实 Git 中未选 beta 保留 pending 投影，另一个未选 staged 删除仍缺失且列入 preservedPendingPaths。
