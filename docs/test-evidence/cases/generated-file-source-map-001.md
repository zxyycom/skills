### Case GENERATED-FILE-SOURCE-MAP-001: Source map 路径保持可移植

Tests:
- `test:3c0b962361a3f8ab535ac061e34401f8099fc9aa507c85f87aa15ae01eb78a71`

Tags:
- `repository-tooling`

Contract:
- 生成 source map 中的 workspace 源路径必须规范化为可移植相对路径。

Proves:
- 绝对路径和平台分隔符不会泄漏到规范化 source map。
