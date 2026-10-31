### Case VERSION-CONTROL-REVISION-SHA256-001: 批量读取 SHA-256 revision 快照

Tests:
- `test:d0e34a1522f0bdbb74cdf27b6b9c93a1369b5b16637b6ccf231792b773f40b5c`

Tags:
- `version-control`

Contract:
- `readRevisionFiles` 不把 Git revision 的对象标识格式限定为 SHA-1，并支持 SHA-256 repository。

Proves:
- 在支持 SHA-256 repository 的 Git 环境中，64 位 revision 返回正确的路径和字节。
