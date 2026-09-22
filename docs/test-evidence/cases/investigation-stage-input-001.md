### Case INVESTIGATION-STAGE-INPUT-001: stage --scope index rejects invalid or duplicate Investigation IDs

Tests:
- `test:0c7d6daca27e99a1c24fbd74c21e37905b2302caefff5e59b7f80a1b53edf960`

Tags:
- `investigation-report`

Contract:
- `stage --scope index` 拒绝重复或非 extensionless Investigation ID。

Proves:
- 重复 ID 返回 duplicate 诊断；路径、`./` 和首尾空白 ID 各返回明确 extensionless 契约的 invalid 诊断。
