### Case INVESTIGATION-STAGE-DOMAIN-PRESERVE-STAGED-DELETION-001: stage --scope domain keeps unrelated staged deletions when staging another report

Tests:
- `test:20ad9f1001408d13e8eb929189f5535672bd3c836d4b0162e88ad6020e39cf32`
- `test:ea0eabe85fd39b11c9b53b83ceec8027faf220675694bdaceee5ea66749e892d`

Tags:
- `investigation-report`

Contract:
- domain stage 不恢复未选路径的 staged 删除。

Proves:
- 共享 Git 发布测试先暂存 tracked 文件删除并保留工作区文件，发布另一选择后删除仍在、工作区文件不变。
- 真实 IR domain stage 使用同一 SourcePublication 并保留未选 pending；本组合不声称 IR fixture 本身包含 staged 删除。
