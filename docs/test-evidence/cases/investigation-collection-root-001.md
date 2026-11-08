### Case INVESTIGATION-COLLECTION-ROOT-001: full validation rejects unknown investigation root members

Tests:
- `test:9fce3c04922a6c38202fdeb907eae7cc944be4d67bb9a8f16ef09aea075289c4`

Tags:
- `investigation-report`

Contract:
- 平铺 Investigation Report 根目录应拒绝未知非报告文件。

Proves:
- 合法基线增加根级 unknown.txt 后完整 check 失败；未断言诊断文本。
