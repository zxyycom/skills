### Case DECISION-EVOLVE-DISCARD-SOURCE-EMPTY-001: 保留空来源关系并删除目标

Tests:
- `test:ffc5a670666b8e5ab8c7d5bb9daace6bde475cba68489791b6ec277bfec0b2c8`

Tags:
- `decision-records`

Contract:
- 未提供覆盖时，候选空来源关系可作为最终空关系，无须显式 clear。

Proves:
- 原生 evolve 保留候选空关系，确认删除 Git 已记录目标后同次提交；最终目标索引项消失且后继 active、关系为空。
