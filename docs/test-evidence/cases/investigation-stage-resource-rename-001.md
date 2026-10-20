### Case INVESTIGATION-STAGE-RESOURCE-RENAME-001: stage --scope index does not accept legacy topic path identifiers

Tests:
- `test:3a8e96173394532aa88587aa0aaffc2566914e8f219942e8c4af153020f9db31`

Tags:
- `investigation-report`

Contract:
- 选择性暂存不接受包含目录前缀的旧路径式标识。

Proves:
- stage 纯准备函数对带目录前缀的 ID 返回 invalid-options、changed=false，且唯一诊断为 stage-report-id-invalid。
