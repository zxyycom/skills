### Case DECISION-STAGE-RENAME-001: Stage 以一个 ID 表达语义 sourcePath 改名

Tests:
- `test:06cf9d31458f574a52e4eb8910ab895985a96d2d086e08251a4123f0401566b4`

Tags:
- `decision-records`

Contract:
- basename 是存储位置而非身份；选择一个显式 ID 时，语义 sourcePath 改名与正文编辑一同进入 pending index，工具不伪造新 ID。

Proves:
- 暂存后同一 ID 保留编辑后的标题，并投影新的语义 sourcePath。
