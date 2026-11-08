### Case DECISION-SEARCH-CURRENT-IDENTITY-001: Decision 非命中身份仍核对

Tests:
- `test:f8b0772cfc1840c342361e4225f2475a8e1bc4c9244cce50fe9cb5b38e1de645`

Tags:
- `record-search`

Contract:
- content 在匹配前核对所选当前来源的声明身份。

Proves:
- 真实 CLI 先成功读取所选当前正文；将 ID 改成其他值且查询词不再命中时，仍以身份错误失败。
