### Case RECORD-SELECTED-SOURCE-SAFETY-001: 局部来源安全与fresh表示保护

Tests:
- `test:a70423865ce37b6b1956b593e5d09f1bca882f65da8e0d666c8ca840bbae0e9e`
- `test:cc44ecab0849e5fb7e5dcc4c982b13c3646dcd1502de77511d25e2c3edcec3d8`

Tags:
- `decision-records`
- `investigation-report`

Contract:
- 所选正文仍须安全普通文件和严格UTF8，独立fresh不得用准备阶段证明代替当前字节与表示。

Proves:
- 所选symlink、非法UTF8、准备后mode变化均拒绝，index维持原字节。
- fresh mode漂移保留外部修改后的mode，不恢复覆盖。
