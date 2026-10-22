### Case RECORD-SEARCH-PRE-READ-CANDIDATE-BUDGET-001: 候选硬限优先于来源读取

Tests:
- `test:72a681412286e65f7f4a9fbfc005f0aaff42d2432ee398f5f8d0a8ceb4b1ccae`

Tags:
- `record-search`

Contract:
- 显式候选超硬限时，在来源读取与身份验证前拒绝。

Proves:
- 超限且文件不存在时仍返回 resource-limit，而非读取失败；验证器未被调用。
