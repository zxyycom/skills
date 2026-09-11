### Case DECISION-STAGE-RENAME-001: Stage 以一个 ID 表达语义 sourcePath 改名

Tests:
- `test:8ef500ca2017ade0687e496b0a4a5fe268f83ac048a11013b6b0fd30ccab0ee1`

Tags:
- `decision-records`

Contract:
- basename 是存储位置而非身份；选择一个显式 ID 时，语义 sourcePath 改名与正文编辑一同进入 pending index，工具不伪造新 ID。

Proves:
- 暂存后同一 ID 保留编辑后的标题，并投影新的语义 sourcePath。
