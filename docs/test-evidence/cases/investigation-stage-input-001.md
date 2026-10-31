### Case INVESTIGATION-STAGE-INPUT-001: stage --scope index rejects invalid or duplicate Investigation IDs

Tests:
- `test:4d7c8a91b1f0200f8a2c0b8435b6e4e1e325dfbf8c47982cef4062dcecdd8ec2`

Tags:
- `investigation-report`

Contract:
- `stage --scope index` 拒绝重复选择、路径式标识与带首尾空白的 Investigation selector。

Proves:
- stage 纯准备函数对重复 ID、路径、`./` 和首尾空白 ID 按输入顺序返回 duplicate/invalid 诊断，结果为 invalid-options、changed=false。
