### Case DECISION-EVOLVE-DISCARD-ARCHIVED-RELATION-001: Evolve discard 接受合法的无关 archived 最终关系

Tests:
- `test:f8259949ae73a43c5e863b0096ea58e33fdfb451b979ece81bb5fb35bda28907`

Tags:
- `decision-records`

Contract:
- `evolve --discard` 不增加删除专属的前序边界；只要最终图合法，后继可指向合法 archived 前序。

Proves:
- 事务删除目标并保留调用方选择的 archived 最终关系。
