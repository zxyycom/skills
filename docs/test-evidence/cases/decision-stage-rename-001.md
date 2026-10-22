### Case DECISION-STAGE-RENAME-001: Stage 以一个 ID 表达语义 sourcePath 改名

Tests:
- `test:8ef500ca2017ade0687e496b0a4a5fe268f83ac048a11013b6b0fd30ccab0ee1`

Tags:
- `decision-records`

Contract:
- basename 是存储位置而非身份；选择一个显式 ID 时，已同步的语义 sourcePath 改名和正文编辑共同刷新 pending。

Proves:
- 真实 stage 暂存 semantic-current.md 的新标题，并删除 before.md 的旧 pending 路径。
