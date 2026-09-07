### Case INVESTIGATION-STAGE-INPUT-001: stage-index rejects invalid or duplicate Investigation IDs

Tests:
- `test:85d37a4bcab0517616b2598547d910cbb5b7ec83a3878e419cdd19c6b4fd0883`

Tags:
- `investigation-report`

Contract:
- `stage-index` 拒绝重复或非 extensionless Investigation ID。

Proves:
- 重复 ID 返回 duplicate 诊断；路径、`./` 和首尾空白 ID 各返回明确 extensionless 契约的 invalid 诊断。
