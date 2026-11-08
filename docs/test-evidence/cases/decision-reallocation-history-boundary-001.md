### Case DECISION-REALLOCATION-HISTORY-BOUNDARY-001: 相继重划区分共享历史记录的角色

Tests:
- `test:025374744dd94acec46a154e4f4e555d828f0be04637abab0c1e17172d65924b`

Tags:
- `decision-records`

Contract:
- 后一次重划可将早先事件的后继作为前序，不能把两次事件合并为角色冲突。

Proves:
- 两次完整 2×2 重划的索引图可通过验证；共享中间记录各有两条前代 outgoing 和后代 incoming 边。该节点未断言 trace 事件呈现或 mutation 选择集。
