### Case INVESTIGATION-INDEX-COMPATIBILITY-001: index rejects legacy definitions

Tests:
- `test:53036db7216e8421d437d501c573a8afaa0e20c75dfa8ae9de7774a90fcf704e`

Tags:
- `investigation-report`

Contract:
- Investigation index 只接受当前 definition 版本。

Proves:
- 真实索引解析器按当前领域 definition 和 expectation 解析内存 JSON 时，拒绝旧 definition 并返回 definition 诊断。
