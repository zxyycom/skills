### Case INVESTIGATION-STAGE-RESOURCE-RENAME-001: stage --scope index does not accept legacy topic path identifiers

Tests:
- `test:3a8e96173394532aa88587aa0aaffc2566914e8f219942e8c4af153020f9db31`

Tags:
- `investigation-report`

Contract:
- 选择性暂存只接受 Investigation ID，不接受旧路径式标识。

Proves:
- 带目录前缀的 ID 返回错误。
