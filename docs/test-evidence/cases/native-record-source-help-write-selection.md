### Case NATIVE-RECORD-SOURCE-HELP-WRITE-SELECTION-001: 写帮助反映实际单源选择规则

Tests:
- `test:86c7c4d14ea864c926d28b2354c372d1bb0573787b969589dae5136a96ac0054`

Tags:
- `cli-help`
- `investigation-report`
- `record-rust`

Contract:
- 写帮助使用与实际操作相同的单源选择规则；无显式选择时使用 defaultWriteKey，未配置则显示工作区；显式多源 key 显示诊断而非成功选择。

Proves:
- help new --key related 退出 0，给出恰好单源要求且无 Selected；未配置写默认时 help new 显示 workspace，不显示读取默认 related 为实际选择。
- 配置写默认后 help new 和 new --help 均标记 default write 并选择 one 及其调查目录；显式 --root . 显示 explicit location，不再选择 one。
