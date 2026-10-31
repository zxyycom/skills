### Case DECISION-SPLIT-OMISSION-001: Evolve 在写入前拒绝遗漏既有拆分后继

Tests:
- `test:f042f664751ec9612ea438f9e82f2ae1a8789852bbd0c213a39b35c07c9fe921`

Tags:
- `decision-records`

Contract:
- 拆分事务的显式 successor 集合必须等于事务后的全部直接拆分后继，不能遗漏任一既有成员。

Proves:
- 纯生命周期准备对遗漏既有拆分后继返回选择不完整领域诊断，指出缺失成员，且结果不含 changes。
