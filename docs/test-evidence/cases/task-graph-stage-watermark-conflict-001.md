### Case TASK-GRAPH-STAGE-WATERMARK-CONFLICT-001: 工作区 revision 回退不改 pending

Tests:
- `test:cbdee5c1661865c13c9641651beb6ec3acca4e53fad29ca4c644ca12beb91d35`

Tags:
- `task-graph`

Contract:
- 工作区 revision 不能低于暂存基线；回退失败保留已有 pending 内容。

Proves:
- 降低 workspace revision 后 stage 返回冲突，pending 字节不变。
