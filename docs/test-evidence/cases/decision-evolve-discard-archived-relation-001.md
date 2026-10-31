### Case DECISION-EVOLVE-DISCARD-ARCHIVED-RELATION-001: Evolve discard 接受合法的无关 archived 最终关系

Tests:
- `test:cf76aebf1cab36cc5bea09a7dd718ffb57fd946762471df84cf23b202a62bf76`

Tags:
- `decision-records`

Contract:
- `evolve --discard` 不增加删除专属的前序边界；只要最终图合法，后继可指向合法 archived 前序。

Proves:
- 事务删除目标并保留调用方选择的 archived 最终关系。
