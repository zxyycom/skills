### Case INVESTIGATION-CANDIDATE-DISCARD-005: 候选删除只消费发布资源声明

Tests:
- `test:e82ad2b85e6ff6cff0b80a01c5c36f24ece006e4df38e267a403e2557c87b9e7`

Tags:
- `investigation-report`

Contract:
- 候选 owner 删除排除索引可见正式引用，不验证未选正式正文的新手改。

Proves:
- 未同步正式正文新增候选资源链接且结构非法，不阻断候选及明确 owner 资源删除。
