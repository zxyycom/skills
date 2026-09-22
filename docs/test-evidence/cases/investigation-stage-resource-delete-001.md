### Case INVESTIGATION-STAGE-RESOURCE-DELETE-001: stage --scope index reports selection diagnostics deterministically

Tests:
- `test:6d1cfa8bf0bfdc8cbe5e03e1e4e35bd95459760c4c33be3d1739ac7d899fa9ea`

Tags:
- `investigation-report`

Contract:
- 选择性暂存对无效选择稳定返回可操作的 diagnostics。

Proves:
- 空选择返回 error 且 diagnostics 非空。
