### Case NATIVE-INSTALLED-EVIDENCE-001: 原生退役归属依赖已验证包与当前文件

Tests:
- `test:124d366059f0f4c06068bb6c060e43c519107018630249da8d7f4d419ecbc760`

Tags:
- `repository-tooling`

Contract:
- 后续更新写入前，已安装原生受管成员须与保存的已验证制品和完成 receipt 一致；receipt 不独立授权退役。

Proves:
- 隔离新装计划不退役文件；匹配证据的原生更新仅计划退役不再包含的已受管文件。修改二进制即使同时改写 receipt 摘要也被拒绝，证据缺失被拒绝。
