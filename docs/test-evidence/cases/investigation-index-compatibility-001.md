### Case INVESTIGATION-INDEX-COMPATIBILITY-001: index rejects legacy definitions

Tests:
- `test:2583481b09403de9209a33ec4cb3e81d5a6e17028aa96e8055360ab8597491f4`

Tags:
- `investigation-report`

Contract:
- Investigation index 只接受当前 definition 版本。

Proves:
- 真实索引解析器按当前领域 definition 和 expectation 解析内存 JSON 时，拒绝旧 definition 并返回 definition 诊断。
