### Case RECORD-SELECTED-SOURCE-SAFETY-001: 局部来源安全与fresh表示保护

Tests:
- `test:01856ac07ce3376d487b5707ab9ca383b64436e3115d4f1c1fa8c68774b3fd1e`
- `test:55d5e20425e199d51403345089b4fe0e169ed33cb58c3a3822cc27bdbd82ee89`

Tags:
- `decision-records`
- `investigation-report`

Contract:
- 所选正文仍须安全普通文件和严格UTF8，独立fresh不得用准备阶段证明代替当前字节与表示。

Proves:
- 所选symlink、非法UTF8、准备后mode变化均拒绝，index维持原字节。
- fresh mode漂移保留外部修改后的mode，不恢复覆盖。
