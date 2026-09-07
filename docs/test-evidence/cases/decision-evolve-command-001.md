### Case DECISION-EVOLVE-COMMAND-001: Evolve 建立单后继并保留已归档前序

Tests:
- `test:c48b002adb6b5d27c40e3f3adb3fc55c0416370808c76b5116c05622b77bc20c`

Tags:
- `decision-records`

Contract:
- 单后继 evolve 可以使用活动和已归档的合法直接前序；事务只归档新增活动前序，并保存调用方提供的完整最终关系集合。

Proves:
- 活动前序在事务后成为 archived，原本已归档的前序继续保持 archived。
- 新后继成为已建立记录，并按输入顺序保存同时指向两类前序的完整关系。
