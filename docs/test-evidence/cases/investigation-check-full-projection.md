### Case INVESTIGATION-CHECK-FULL-PROJECTION-001: 全量检查比较完整投影

Tests:
- `test:9fce3c04922a6c38202fdeb907eae7cc944be4d67bb9a8f16ef09aea075289c4`

Tags:
- `investigation-report`

Contract:
- 全量 check 比较完整索引投影，来源 revision 相同不足以证明投影正确。

Proves:
- 健康 IR 索引只篡改 entry title 并保留原 revision 时，full check 返回 index-not-current。
