### Case DECISION-SEARCH-CURRENT-IDENTITY-001: Decision 非命中身份仍核对

Tests:
- `test:c276c3346e953b8116d98f3344d1d0ceb3a865c638df20d917e6e10d6b2f5444`

Tags:
- `record-search`

Contract:
- 安全读取后的同份文本在匹配前核对身份，不要求完整正文或其他 metadata 语义验证。

Proves:
- 非命中文件身份错误仍失败；未改变身份的非完整语义文本不被额外拒绝。
