### Case VERSION-CONTROL-REVISION-SHA256-001: 批量读取 SHA-256 revision 快照

Tests:
- `test:53bfd53effc2bc3041482b6ca320202f6893d490c472803be2145796ab3bab6a`

Tags:
- `version-control`

Contract:
- `readRevisionFiles` 不把 Git revision 的对象标识格式限定为 SHA-1，并支持 SHA-256 repository。

Proves:
- 在支持 SHA-256 repository 的 Git 环境中，64 位 revision 返回正确的路径和字节。
