### Case NATIVE-LEGACY-CONCURRENT-ROLLBACK-001: 回滚不覆盖并发更改

Tests:
- `test:9ea32b3dfe4b4fe2720e75869286e9b90b56ff050be823f1b187ac7c0f8e1c84`

Tags:
- `repository-tooling`

Contract:
- 激活前回滚只恢复仍可归因于本次写入的目标；发现后续改写须保留现场并报告恢复不完整。

Proves:
- 私有 fixture 的验证回调改写新二进制后失败，回滚不覆盖该变更，旧入口和无关文件保留，恢复目录可定位。
