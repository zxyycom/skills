### Case DECISION-EVOLVE-DISCARD-SPLIT-CLOSURE-001: Evolve 用完整拆分闭包替换被 discard 的后继

Tests:
- `test:29e6b1fabffb1f68e21ab377278f685bd72f68390f2e2a08bb0a7f23467d3864`

Tags:
- `decision-records`

Contract:
- discard 与 evolve 都在同一最终关系图上接受操作；evolve 可以删除一个已建立的拆分后继，只要其余被选后继和新候选共同构成完整闭包。

Proves:
- evolve 同时删除一个拆分后继并建立替代后继后，索引不再含被删除 ID，替代后继保留正确拆分关系。
- 最终 Decision Records 校验通过，证明最终图仍是闭合拆分。
