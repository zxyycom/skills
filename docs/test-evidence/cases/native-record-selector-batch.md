### Case NATIVE-RECORD-SELECTOR-BATCH-001: 批量名称选择与诊断

Tests:
- `test:0084a5bbe16c69f00f8b56ac551039f9d501e0a9aca627e5d3bc56d4e996fcfb`
- `test:eca3f6ff79e82762801296cb35e9106ab97d80445d1c4c08d3edc2400bd56272`

Tags:
- `record-rust`

Contract:
- 批量选择保持名称、完整 ID 与后缀语义，并稳定报告缺失、歧义和重复。

Proves:
- 固定索引独立断言名称、完整 ID、缺失和歧义顺序；两域选择核对缺失、歧义及别名重复的诊断顺序。
