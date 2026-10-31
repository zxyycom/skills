### Case RECORD-SEARCH-SAME-TEXT-VALIDATION-001: 记录检索在匹配前核对同份文本

Tests:
- `test:aca9859df6f20ca961e56f71aab8b6da8f24bf3da16d5e9a06b5f34fa0c71151`

Tags:
- `record-search`

Contract:
- 安全读取后的同份文本在匹配前核对身份，不要求完整正文或其他 metadata 语义验证。

Proves:
- 验证器拿到非命中文件的实际文本并可阻断搜索；未配置验证器时普通检索仍返回后续命中。
