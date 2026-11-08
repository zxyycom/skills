### Case GATE-RETIRED-RECORD-SDK-INPUT-001: 已退役 SDK 重新出现时保守执行

Tests:
- `test:4c9606d278208e5762e7880e2ace2acf7f013a95e4580573a82224ee8abfe4a2`

Tags:
- `repository-tooling`

Contract:
- 两域旧 TypeScript SDK 和专属测试目录不再是声明的领域能力；重新出现文件时不能复用成功证明。

Proves:
- DR、IR 和 record-operations 的旧目录重现源码或测试时，标记未分类，执行全部 receipt-managed 检查且拒绝发布新证明。
