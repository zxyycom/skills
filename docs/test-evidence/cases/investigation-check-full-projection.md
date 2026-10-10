### Case INVESTIGATION-CHECK-FULL-PROJECTION-001: 全量检查比较完整投影

Tests:
- `test:d7bb287805fa76b76e86579c29864dae58b63cc4f10ecc716c3a78e1391cbd70`

Tags:
- `investigation-report`

Contract:
- 全量 check 比较完整索引投影；来源 revision 相同不足以证明投影正确。

Proves:
- 仅伪造发布 title 而保持 revision，check 仍以 index-stale 失败。
