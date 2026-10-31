### Case DECISION-TRACE-ADMISSION-LINEAR-001: split 与 merge 单次发现并复用稳定单位

Tests:
- `test:880d910195ccaeda4c3a416c1f5e56c0296ea688e414fd6040f2d2173c05b9c9`

Tags:
- `decision-records`

Contract:
- 单次查询复用事件成员，每次 from/direction 扩展按事件去重；相同 direct 集合才复用 frozen admission unit。

Proves:
- d=10/100/1000 的 split/merge 事件从焦点各返回一个完整单位，成员反向扩展复用同一 frozen unit；实际 graph edge type 访问不超过 6d+2。
