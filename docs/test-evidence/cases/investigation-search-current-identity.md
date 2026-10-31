### Case INVESTIGATION-SEARCH-CURRENT-IDENTITY-001: Investigation 非命中身份仍核对

Tests:
- `test:d91c5b9003802099021b92a043106a30f440b3fbbb21d510063698da316ae378`

Tags:
- `record-search`

Contract:
- 安全读取后的同份文本在匹配前核对身份，不要求完整正文或其他 metadata 语义验证。

Proves:
- 非命中文件身份错误仍失败；未改变身份的非完整语义文本不被额外拒绝。
