### Case VERSION-CONTROL-REVISION-SHA256-001: 批量读取 SHA-256 revision 快照

Tests:
- `test:a1c06db59f7dac4192fa64daec8b06846eca41532f2cd63d8cba2e2eaf168d2f`

Tags:
- `version-control`

Contract:
- `readRevisionFiles` 不把 Git revision 的对象标识格式限定为 SHA-1，并支持 SHA-256 repository。

Proves:
- 在支持 SHA-256 repository 的 Git 环境中，64 位 revision 返回正确的路径和字节。
