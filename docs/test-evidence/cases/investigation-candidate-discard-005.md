### Case INVESTIGATION-CANDIDATE-DISCARD-005: 候选删除只消费发布资源声明

Tests:
- `test:63676bc3474ee6193f3cf0f003c466c2b015c63570c329c8d8cbeb100a1830d6`

Tags:
- `investigation-report`

Contract:
- 候选 owner 删除排除索引可见正式引用，不验证未选正式正文的新手改。

Proves:
- 未同步正式正文新增候选资源链接且结构非法，不阻断候选及明确 owner 资源删除。
