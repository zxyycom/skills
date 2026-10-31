### Case INVESTIGATION-COLLECTION-LAYOUT-001: full validation rejects nested report directories

Tests:
- `test:7f4c0fa39ac0bad0bba5d3531b62b730cb180481aa21ae1fd63b4b8f3272b0fa`

Tags:
- `investigation-report`

Contract:
- 平铺 Investigation Report 集合不允许嵌套报告目录。

Proves:
- 根目录出现嵌套旧目录时，完整验证返回 not-allowed 诊断。
