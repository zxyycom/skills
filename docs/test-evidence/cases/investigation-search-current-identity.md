### Case INVESTIGATION-SEARCH-CURRENT-IDENTITY-001: Investigation 非命中身份仍核对

Tests:
- `test:26e823bbc9c428c4803e766b850ae59e95013e31ee8e4b6256c6703e8a76f1f1`

Tags:
- `record-search`

Contract:
- 安全读取后的同份文本在匹配前核对身份，不要求完整正文或其他 metadata 语义验证。

Proves:
- 非命中文件身份错误仍失败；未改变身份的非完整语义文本不被额外拒绝。
