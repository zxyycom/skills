### Case INVESTIGATION-CANDIDATE-DISCARD-005: 候选删除只消费发布资源声明

Tests:
- `test:72e0dedd5e750cc538fedc9c6f308078f79b5e4362998383a50bd75c997cc0e7`

Tags:
- `investigation-report`

Contract:
- 候选删除依据发布索引，不验证未选正式正文的新手改。

Proves:
- 未选正式正文损坏时，候选与 owner 资源删除成功；正式正文及发布索引字节保留。
