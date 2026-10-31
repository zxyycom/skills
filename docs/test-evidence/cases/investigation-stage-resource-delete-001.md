### Case INVESTIGATION-STAGE-RESOURCE-DELETE-001: stage --scope index reports selection diagnostics deterministically

Tests:
- `test:a86735ce1f82ad4968a81fdb9a4946470b486cfc11da68248afb075784d9a2b2`

Tags:
- `investigation-report`

Contract:
- 选择性暂存对无效选择稳定返回可操作的 diagnostics。

Proves:
- stage 纯准备函数对空选择返回 invalid-options、changed=false，且唯一诊断为 stage-report-ids-empty。
