### Case TEST-EVIDENCE-PROJECT-COVERAGE-001: 项目检查拒绝未被 Case 覆盖的注册测试

Tests:
- `test:00af63449b1c74cb910cfe1ec3526f603ba62e9210b5fd7122068b3dfd5b0efa`

Tags:
- `repository-tooling`

Contract:
- 项目 wrapper 必须要求每个注册实体都有有效 Case，并在覆盖完整时成功；完整来源 revision 命中的已验证 snapshot fact 可以跨检查复用，Case 变化仍须重新完成引用和覆盖判断。

Proves:
- 临时 Case-only 账本先报告 entity-without-case 并形成内容寻址 snapshot；只补齐第二个 Case 和索引后检查返回 ok，cache 文件身份不变，证明实体 fact 被复用而覆盖结论仍重新形成。
