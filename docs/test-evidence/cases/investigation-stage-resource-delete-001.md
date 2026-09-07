### Case INVESTIGATION-STAGE-RESOURCE-DELETE-001: stage-index reports selection diagnostics deterministically

Tests:
- `test:637f05ebfd34ac901fa101d1d5b6f32ef1383a045f4b1d720cf4d5f57ec56ae5`

Tags:
- `investigation-report`

Contract:
- 选择性暂存对无效选择稳定返回可操作的 diagnostics。

Proves:
- 空选择返回 error 且 diagnostics 非空。
