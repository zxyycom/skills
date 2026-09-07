### Case DECISION-SPLIT-OMISSION-001: Evolve 在写入前拒绝遗漏既有拆分后继

Tests:
- `test:837c930020a2e67061c0b7a5edc179d78bb38dbb97611ce09b9d36e74a445708`

Tags:
- `decision-records`

Contract:
- 拆分事务的显式 successor 集合必须等于事务后的全部直接拆分后继，不能遗漏任一既有成员。

Proves:
- 省略一个既有后继时，诊断指出选择集合不完整并列出被遗漏路径。
- 拒绝路径保留新增候选原文和完整 decision-index.json，不产生部分扩充。
