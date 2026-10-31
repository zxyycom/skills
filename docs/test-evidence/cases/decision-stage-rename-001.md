### Case DECISION-STAGE-RENAME-001: Stage 以一个 ID 表达语义 sourcePath 改名

Tests:
- `test:f4aa931aec0f374db27eb28c43d85af552245453662ed3d5dd5b406eb1d5289e`

Tags:
- `decision-records`

Contract:
- basename 是存储位置而非身份；选择一个显式 ID 时，已同步的语义 sourcePath 改名和正文编辑共同刷新 pending。

Proves:
- 真实 stage 暂存 semantic-current.md 的新标题，并删除 before.md 的旧 pending 路径。
