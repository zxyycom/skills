### Case DECISION-METADATA-REMOVED-001: 拒绝移除领域字段与未知 frontmatter

Tests:
- `test:a853b9be856099b1b312526c72db31e2bd205e4a720dbe76a83a9245deedd794`

Tags:
- `decision-records`

Contract:
- 当前 frontmatter 只接受定义字段；已移除的 domain/domains 及未知字段必须失败。

Proves:
- 对 domain、domains、extra 三种字段均产生验证错误。
