### Case INVESTIGATION-COLLECTION-LAYOUT-001: full validation rejects nested report directories

Tests:
- `test:9fce3c04922a6c38202fdeb907eae7cc944be4d67bb9a8f16ef09aea075289c4`

Tags:
- `investigation-report`

Contract:
- 平铺 Investigation Report 集合不允许嵌套报告目录。

Proves:
- 合法基线增加根级嵌套目录后完整 check 失败；未断言诊断文本。
