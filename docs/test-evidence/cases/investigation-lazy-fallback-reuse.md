### Case INVESTIGATION-LAZY-FALLBACK-001: 正文搜索复用投影关系图

Tests:
- `test:f30e68b61a63d54e527108088ce7fd1a1ba3e628e3a9fd9a1f3f240cce7e6b8b`

Tags:
- `investigation-report`

Contract:
- content 使用提供的发布投影关系上下文。

Proves:
- 返回正确后继与摘要和 published-index+current-text 来源，复用图引用。
