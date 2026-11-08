### Case INVESTIGATION-CANDIDATE-COMPLETE-LAYOUT-001: 候选资源查询使用发布 owner 声明

Tests:
- `test:cdbbe1727809431145c0d2a70dfb54b66bd95d0c6b8d5ce190d9dcc4cbae5b5f`

Tags:
- `investigation-report`

Contract:
- 候选共享资源的正式 owner 声明来自合法发布索引，而不是未选正式正文。

Proves:
- 发布索引声明 owner 且资源存在时，owner 正文损坏或移位不影响候选资源 ready；索引损坏或缺失时查询失败。
