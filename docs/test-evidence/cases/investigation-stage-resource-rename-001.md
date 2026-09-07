### Case INVESTIGATION-STAGE-RESOURCE-RENAME-001: stage-index does not accept legacy topic path identifiers

Tests:
- `test:055d3f119c310f2bafa472808e54d8e53b1f8e857063dafd8d67da9967581eb0`

Tags:
- `investigation-report`

Contract:
- 选择性暂存只接受 Investigation ID，不接受旧路径式标识。

Proves:
- 带目录前缀的 ID 返回错误。
