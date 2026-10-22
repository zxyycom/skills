### Case INVESTIGATION-LAZY-FALLBACK-001: 正文搜索复用投影关系图

Tests:
- `test:7270df03fdfeded7fce3734a34244f3b4318ab4094c038093533f628e4acca8f`

Tags:
- `investigation-report`

Contract:
- content 使用提供的发布投影关系上下文。

Proves:
- 返回正确后继与摘要和 published-index+current-text 来源，复用图引用。
