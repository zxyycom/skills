### Case DECISION-ACTIVATE-RELATION-REPLACE-001: 候选来源关系被完整覆盖

Tests:
- `test:18c042b1249b872ffda1f29bcd991ee2e4f97a3762bef802bb689cb699a6de10`

Tags:
- `decision-records`

Contract:
- evolve 关系覆盖替换候选来源的完整关系集合，不与旧边合并。

Proves:
- 候选原指向待删除目标，显式覆盖为两个不同前序后提交；最终索引仅包含两条新目标，原目标删除。此节点使用原生操作，不验证 CLI 参数。
