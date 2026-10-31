### Case TASK-GRAPH-STAGE-WATERMARK-CONFLICT-001: 工作区 revision 回退不改 pending

Tests:
- `test:3c26dd210e0c1a1f91d5d9bc62d1fd36a926393e8b2946faa35263259e4e0566`

Tags:
- `task-graph`

Contract:
- 工作区 revision 不能低于暂存基线；回退失败保留已有 pending 内容。

Proves:
- 降低 workspace revision 后 stage 返回冲突，pending 字节不变。
