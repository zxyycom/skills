### Case DECISION-STAGE-RELATED-SOURCE-001: Stage 使用索引关系依赖而不验收未选正文

Tests:
- `test:c38b8a834a4b91164b69267a6f0e5c398c7d685f42c0a1377c008a494c82addf`

Tags:
- `decision-records`

Contract:
- all scope 的最终关系图由发布索引验证，未选相关来源不自动读取或刷新。

Proves:
- B 只 domain 暂存新正文而 pending 索引仍旧时，stage A 成功且原 pending tree 不变，B 正文保留；显式同选 A/B 后索引才接纳 B 的新投影。
