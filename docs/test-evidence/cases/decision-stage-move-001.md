### Case DECISION-STAGE-MOVE-001: 选择同一 ID 的当前 sourcePath 并构建移动投影

Tests:
- `test:d6c5b6a134f6e486713495e46865c80ad6cd1234061a752a98a0f4860d7f1030`

Tags:
- `decision-records`

Contract:
- 同一 ID 从 root 移到 archive 后，领域 target 仅选择当前 sourcePath，派生索引保持唯一 ID 与归档定位。

Proves:
- 纯 target 的来源与 sourceFiles 只含 archive/selected.md；生产索引投影唯一 entry 的 sourcePath 为 archive/selected.md，status 为 archived。
