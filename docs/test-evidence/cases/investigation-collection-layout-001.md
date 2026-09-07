### Case INVESTIGATION-COLLECTION-LAYOUT-001: full validation rejects nested report directories

Tests:
- `test:a98ad0bc1cb5abc2a86ca959ae392b381d3c563487c49b56e3a38f70d230d2ee`

Tags:
- `investigation-report`

Contract:
- 平铺 Investigation Report 集合不允许嵌套报告目录。

Proves:
- 根目录出现嵌套旧目录时，完整验证返回 not-allowed 诊断。
