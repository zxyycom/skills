### Case RECORD-SEARCH-PRE-READ-CANDIDATE-BUDGET-001: 候选硬限优先于来源读取

Tests:
- `test:5b060ac7eedc6d1f244d998e0f6f72afb3aa650b253f673ff2c144ff20a49ec8`

Tags:
- `record-search`

Contract:
- 显式候选超硬限时，在来源读取与身份验证前拒绝。

Proves:
- 超限且文件不存在时仍返回 resource-limit，而非读取失败；验证器未被调用。
