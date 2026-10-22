### Case INVESTIGATION-LOCAL-RELATION-DEPENDENCIES-001: 关系事务保留无关投影并验证完整事件

Tests:
- `test:d75aae30b571c410c45e8adf17ffb999e436be8bcab4ed9b1566700d5320301c`

Tags:
- `investigation-report`

Contract:
- set-relations 读取所选来源、直接关系、完整受涉拆分事件及必要 owner；未选无关来源沿用发布投影。

Proves:
- 无关损坏正文不被读取，关系更新后原发布条目与 revision 保持；未选但属于同一拆分事件的 sibling 来源漂移会阻断后续更新并保留全部写入目标字节。
