### Case DECISION-STAGE-RENAME-001: Stage 以一个 ID 表达语义 sourcePath 改名

Tests:
- `test:f46f104e5ce84c3294a22b131385495083983e819190134032dfc126c6a01adb`

Tags:
- `decision-records`

Contract:
- basename 是存储位置而非身份；同步后单选 ID 可暂存语义路径移动与正文编辑。

Proves:
- 同一 ID 从 before.md 移到 semantic-current.md 且标题改变后，all scope 暂存新正文字节和索引路径并清理旧 pending。
