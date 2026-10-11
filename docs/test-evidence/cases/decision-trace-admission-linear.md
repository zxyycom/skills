### Case DECISION-TRACE-ADMISSION-LINEAR-001: split 与 merge 单次发现并复用稳定单位

Tests:
- `test:2ba6061edd370040cd69331473aade43deed11177220b494dbd28ee363ef13b3`

Tags:
- `decision-records`

Contract:
- 单次查询复用事件成员，每次 from/direction 扩展按事件去重；相同 direct 集合才复用 frozen admission unit。

Proves:
- d=10/100/1000 的 split/merge 事件从焦点各返回一个完整单位，成员反向扩展复用同一 frozen unit；实际 graph edge type 访问不超过 6d+2。
