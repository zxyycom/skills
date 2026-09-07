### Case TASK-GRAPH-CLI-PROTOTYPE-001: Prototype-like command 和 option 被拒绝

Tests:
- `test:b24981cf5ec39866055cf2cbe44788d540c7b6460f79f98e0697f14e819bcae2`

Tags:
- `task-graph`

Contract:
- CLI catalog 与 option lookup 不得从对象原型继承伪 command 或伪 option。

Proves:
- help constructor 与 --constructor 都返回 ARGUMENT_INVALID JSON。
