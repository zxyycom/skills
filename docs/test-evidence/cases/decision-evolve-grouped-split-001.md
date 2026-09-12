### Case DECISION-EVOLVE-GROUPED-SPLIT-001: Evolve 为闭合拆分的每个后继保存独立摘要

Tests:
- `test:a99715aebebe4f2347e7a5ce0c0bbd73cb393ededb4a1a6e79fc2364e3eb9817`

Tags:
- `decision-records`

Contract:
- 闭合拆分的完整 successor 集合可以在一次 `evolve` 事务中为每个 source 完整替换关系，并让同一 predecessor 的边保存不同摘要。

Proves:
- 等号形式和分开的 option 形式都能绑定到各自分组；committed review 显示两组摘要，两个已建立后继分别保留自己的完整拆分边，严格检查通过；移除一个摘要时，review 完整显示两个 source 的 before/after 和未变关系。
