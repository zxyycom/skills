### Case DECISION-EVOLVE-UNSUPPORTED-MULTI-001: Evolve 拒绝无关的多后继

Tests:
- `test:44fc39c07a38a803bde5f6d09931f173baa1bf4f046c36c6ae2ab93be53abed6`

Tags:
- `decision-records`

Contract:
- 非拆分、非重划的关系形状只能选择一个后继。

Proves:
- 两个空关系候选同时被选中时，原生预检拒绝，两个候选字节保留且无索引创建。此节点不穷举普通关系与事件混合。
