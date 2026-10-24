### Case TEST-EVIDENCE-PROJECT-COVERAGE-001: 项目检查拒绝未被 Case 覆盖的注册测试

Tests:
- `test:00af63449b1c74cb910cfe1ec3526f603ba62e9210b5fd7122068b3dfd5b0efa`

Tags:
- `repository-tooling`

Contract:
- 项目 wrapper 必须要求每个注册实体都有有效 Case，并在覆盖完整时成功；完整来源 revision 命中的已验证 snapshot fact 可以跨检查复用，Case 变化仍须重新完成引用和覆盖判断。

Proves:
- 临时账本先返回 entity-without-case 并写 snapshot cache；补齐 Case/index 后返回 ok，cache 文件 inode 未替换。该身份观察不证明零注册或零重复计算，覆盖结论在本次重新判断。
