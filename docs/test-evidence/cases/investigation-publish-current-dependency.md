### Case INVESTIGATION-PUBLISH-CURRENT-DEPENDENCY-001: 发布使用未选依赖的索引声明

Tests:
- `test:3184a8685cabc846e131c44302af75558d6e6d6c833e25defd62be36e3d7272f`

Tags:
- `investigation-report`

Contract:
- 普通发布使用未选正式依赖的发布索引，不以其当前正文健康作为门禁。

Proves:
- 依赖正文缺失、损坏、过期以及 Unix 符号链接四种 fixture 均通过预检和发布，未引用资源字节保留。
