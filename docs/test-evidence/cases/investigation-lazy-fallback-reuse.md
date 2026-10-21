### Case INVESTIGATION-LAZY-FALLBACK-001: 正文降级搜索复用集合校验图

Tests:
- `test:9dc52e829e3cdbc57cb2d3d3b3e1009278510e36541e85c98da89c6568bd27e0`

Tags:
- `investigation-report`

Contract:
- content fallback 在完整集合验证成功后，继续使用同一投影及其关系图，不重新构图或弱化来源校验。

Proves:
- 真实集合采集与验证后 content 搜索返回正确后继和摘要、fallback 来源标记；搜索沿用图引用，未再投影原始 relations。
