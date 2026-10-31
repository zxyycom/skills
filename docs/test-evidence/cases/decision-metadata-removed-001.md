### Case DECISION-METADATA-REMOVED-001: 拒绝移除领域字段与未知 frontmatter

Tests:
- `test:a4a63d5c9856851f5e8345eca6943d59f284d0fc1b915885eb2881b2dbac014f`

Tags:
- `decision-records`

Contract:
- 当前 frontmatter 只接受定义字段；已移除的 domain/domains 及未知字段必须失败。

Proves:
- 在 ID 匹配的合法正文中加入 domain、domains、extra 三种字段，分别产生 unsupported keys 专属诊断。
