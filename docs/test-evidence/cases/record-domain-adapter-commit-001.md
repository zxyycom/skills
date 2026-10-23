### Case RECORD-DOMAIN-ADAPTER-COMMIT-001: 两域真实适配器执行同一提交后拒绝契约

Tests:
- `test:1dfe413eec257e15a3490701af370c900fdb24f5ad910e0d425fb73f005c2805`
- `test:e97d969fc13fd805c22681dc764cc7e04bfd337100906ea44f0eb92388fe5688`

Tags:
- `decision-records`
- `investigation-report`
- `record-operations`

Contract:
- 真实领域适配器都遵守正式索引实际发布提交点，writer随后拒绝时保留已提交变化与partial-or-unknown，不附成功review。

Proves:
- 共享契约分别通过DR applyPreparedDecisionTransaction与IR setInvestigationRelations执行；在真实索引rename后抛错，两域均失败且changed，来源与索引新字节保留，源mode0640不变。
