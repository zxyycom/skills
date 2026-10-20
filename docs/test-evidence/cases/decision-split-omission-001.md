### Case DECISION-SPLIT-OMISSION-001: Evolve 在写入前拒绝遗漏既有拆分后继

Tests:
- `test:17668551ea25b7191b7f703804a2e2aa2cddba7b20a530831c1c5ccc2502cccd`

Tags:
- `decision-records`

Contract:
- 拆分事务的显式 successor 集合必须等于事务后的全部直接拆分后继，不能遗漏任一既有成员。

Proves:
- 纯生命周期准备对遗漏既有拆分后继返回选择不完整领域诊断，指出缺失成员，且结果不含 changes。
