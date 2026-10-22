### Case DECISION-SEARCH-FALLBACK-001: 发布范围内读取当前正文

Tests:
- `test:2232aa07aad0753dd20c12316562e5839453ad5687237566e8a200c4cf978745`

Tags:
- `decision-records`

Contract:
- content 按发布范围读取当前文本，不检查全集新鲜度。

Proves:
- 新正文词返回已有 Decision ID，stderr 无降级提示，索引字节不变。
