### Case TASK-GRAPH-CLI-PROTOTYPE-001: Prototype-like command 和 option 被拒绝

Tests:
- `test:ddd02eaee681fae5fdb15f3f23740498b85d0691cc0a4a13b0e55c389feb793a`

Tags:
- `task-graph`

Contract:
- CLI catalog 与 option lookup 不得从对象原型继承伪 command 或伪 option。

Proves:
- help constructor 与 --constructor 都返回 ARGUMENT_INVALID JSON。
