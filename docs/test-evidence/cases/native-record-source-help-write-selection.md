### Case NATIVE-RECORD-SOURCE-HELP-WRITE-SELECTION-001: 写帮助反映实际单源选择规则

Tests:
- `test:86c7c4d14ea864c926d28b2354c372d1bb0573787b969589dae5136a96ac0054`

Tags:
- `cli-help`
- `investigation-report`
- `record-rust`

Contract:
- 写帮助使用与实际操作相同的单源选择规则；无显式 key 时显示工作区，显式多源 key 显示诊断而非成功选择。

Proves:
- help new --key related 退出 0，给出恰好单源要求且无 Selected；未传 key 的 help new 退出 0 并显示 workspace，不显示 related 为实际选择。
