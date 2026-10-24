### Case INVESTIGATION-PUBLISH-RESOURCE-IDENTITY-001: 发布前拒绝资源 inode 漂移

Tests:
- `test:763dc1ad5f6a205784e517fbff963f77b5eda48105b100606d376d14a67be72b`

Tags:
- `investigation-report`

Contract:
- 候选资源成员 identity 必须保持；同路径新 inode 不能冒充准备时成员。

Proves:
- 资源换为同路径新 inode 后 publish 失败，外层观察 writer 零调用，候选正文保留。
