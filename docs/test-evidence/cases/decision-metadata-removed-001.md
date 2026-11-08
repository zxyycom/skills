### Case DECISION-METADATA-REMOVED-001: 拒绝移除领域字段与未知 frontmatter

Tests:
- `test:f849833056c7db08c851f0024c5fae21afe226dda6e8bb519f8db436c4c594d1`

Tags:
- `decision-records`

Contract:
- 当前 frontmatter 只接受定义字段；已移除的 domain/domains 及未知字段必须失败。

Proves:
- 原生 frontmatter parser 对有效样例成功，分别加入 domain、domains 或 extra 后拒绝；节点不断言旧 TS 诊断文本。
