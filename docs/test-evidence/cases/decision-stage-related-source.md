### Case DECISION-STAGE-RELATED-SOURCE-001: Stage 使用索引关系依赖而不验收未选正文

Tests:
- `test:175567f816c775ad084b14fdc675e18c320bced2ec0646722acd0f66c263978b`

Tags:
- `decision-records`

Contract:
- all scope 用 pending 发布投影验证关系，未选相关来源不自动刷新。

Proves:
- 真实 Git 中 B 先 domain 暂存新正文但索引仍旧，stage A 保持 pending 条目及 B 新正文；同选 A/B 后索引才纳入 B 新标题。
