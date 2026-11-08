### Case DECISION-STAGE-MOVE-001: 选择同一 ID 的当前 sourcePath 并构建移动投影

Tests:
- `test:f46f104e5ce84c3294a22b131385495083983e819190134032dfc126c6a01adb`

Tags:
- `decision-records`

Contract:
- 同一 ID 已同步的 sourcePath 移动应清理旧 pending 路径并暂存当前来源。

Proves:
- 真实 Git 中语义路径从 before.md 变为 semantic-current.md，all scope 移除旧 pending 路径、暂存新正文和新索引路径，未选 pending 保持。
