### Case DECISION-EVOLVE-DISCARD-ARCHIVED-RELATION-001: Evolve discard 接受合法的无关 archived 最终关系

Tests:
- `test:c0a7eca078cea292467ea7af2af6a2cfc6a93cf17e8d003ade1c0a9f8986ae37`

Tags:
- `decision-records`

Contract:
- `evolve --discard` 不增加删除专属的前序边界；只要最终图合法，后继可指向合法 archived 前序。

Proves:
- 事务删除目标并保留调用方选择的 archived 最终关系。
