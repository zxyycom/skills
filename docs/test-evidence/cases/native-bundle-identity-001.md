### Case NATIVE-BUNDLE-IDENTITY-001: 原生包与运行时按发布身份绑定

Tests:
- `test:ee946f7f4b964f9ae7b72a44fd37c9f47e2d80c40558f3de6d0b22272912e209`

Tags:
- `repository-tooling`

Contract:
- 生成安装计划前，skill 包、目标二进制 ZIP 与包内身份描述符必须匹配同一发布角色、版本、源码和资产摘要。

Proves:
- 匹配的私有样本生成角色二进制目标；资产字节或描述符源码摘要错配时拒绝。
- 此项只验证准备的身份边界，不执行原生程序或安装文件。
- 即使重新计算 ZIP 摘要，skill 版本错误或运行时压缩包包含错误角色也被拒绝。
