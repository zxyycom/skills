### Case TASK-GRAPH-CLI-PROTOTYPE-001: Prototype-like command 和 option 被拒绝

Tests:
- `test:77a733a7866976394955e6b96a79c466baca9f23b57ec6a1d7f7a7cdd27bc0be`

Tags:
- `task-graph`

Contract:
- CLI catalog 与 option lookup 不得从对象原型继承伪 command 或伪 option。

Proves:
- help constructor 与 --constructor 都返回 ARGUMENT_INVALID JSON。
