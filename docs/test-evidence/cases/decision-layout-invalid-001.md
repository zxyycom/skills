### Case DECISION-LAYOUT-INVALID-001: 拒绝状态与归档路径不匹配

Tests:
- `test:1562e0ec86731ee6252e448882419a3cdcb464f96d79214ba4414bb54f792569`

Tags:
- `decision-records`

Contract:
- 正式决策状态与 sourcePath 所在生命周期位置必须一致。

Proves:
- active 正文以 archive 路径解析失败。
