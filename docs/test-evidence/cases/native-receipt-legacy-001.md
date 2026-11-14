### Case NATIVE-RECEIPT-LEGACY-001: 旧运行时回执与第三角色准备

Tests:
- `test:7ef946228d8c41246f680b8791d5f41a691884411103f529df5e66b9b3043b80`

Tags:
- `native-delivery`

Contract:
- 读取 v1 双角色 receipt 不补造第三摘要；旧角色仍可调用，第三角色和完整运行时要求重新 prepare。

Proves:
- 隔离 fixture 中旧 receipt 保持无资源摘要，旧角色验证通过，指定资源角色和全角色检查均返回 prepare 提示。
