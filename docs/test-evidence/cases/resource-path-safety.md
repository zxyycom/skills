### Case RESOURCE-PATH-SAFETY-001: 记录索引路径与外置位置校验

Tests:
- `test:41836dfe8f763f4c8514a9116c87d8ede1794928d536d17371fe4e665daeba1f`
- `test:72f89a59280d7f005ae5aef296806b3ba80bf23fb9006ab3567589169add59de`

Tags:
- `resource-records`

Contract:
- 索引只可定位 records 直属 Markdown，外置位置须为有效相对定位。

Proves:
- 伪造同内容 .txt 的索引路径不得被 show 当作当前记录，外置位置含 NUL 时同步失败。
