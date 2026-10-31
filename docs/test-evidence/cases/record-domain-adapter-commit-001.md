### Case RECORD-DOMAIN-ADAPTER-COMMIT-001: 两域真实适配器执行同一提交后拒绝契约

Tests:
- `test:aba644c3c6e06c4c4368c6930168fa76a14a6be836455a22fdcda63c9c2e8901`
- `test:d5ed84db445e1aa409cd87cdc1bf2154427f48a96777b77de3cd160c0f38da70`

Tags:
- `decision-records`
- `investigation-report`
- `record-operations`

Contract:
- 真实领域适配器都遵守正式索引实际发布提交点，writer随后拒绝时保留已提交变化与partial-or-unknown，不附成功review。

Proves:
- 共享契约分别通过DR applyPreparedDecisionTransaction与IR setInvestigationRelations执行；在真实索引rename后抛错，两域均失败且changed，来源与索引新字节保留，源mode0640不变。
