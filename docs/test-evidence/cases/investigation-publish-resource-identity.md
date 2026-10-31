### Case INVESTIGATION-PUBLISH-RESOURCE-IDENTITY-001: 发布前拒绝资源 inode 漂移

Tests:
- `test:bbe939c902ffdd07a00a331148578833b7b0af16e4d9edd8a019fef996e106c8`

Tags:
- `investigation-report`

Contract:
- 候选资源成员 identity 必须保持；同路径新 inode 不能冒充准备时成员。

Proves:
- 资源换为同路径新 inode 后 publish 失败，外层观察 writer 零调用，候选正文保留。
