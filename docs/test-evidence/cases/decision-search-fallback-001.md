### Case DECISION-SEARCH-FALLBACK-001: 发布范围内读取当前正文

Tests:
- `test:be47b8b23d77fcd974b344d780ba5861cd11440813143f9e1b19efa7b02989bb`

Tags:
- `decision-records`

Contract:
- content 按发布范围读取当前文本，不检查全集新鲜度。

Proves:
- 新正文词返回已有 Decision ID，stderr 无降级提示，索引字节不变。
