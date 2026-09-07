### Case DECISION-RECORD-GUARD-IDENTITY-001: Record 类型守卫拒绝无效身份字段

Tests:
- `test:ed55d834488b879dd65d7f8d3d483edf0cafb6eb3b6a738bd468316133409305`

Tags:
- `decision-records`

Contract:
- 公开的 candidate、established 和 activation record 类型守卫除 source kind 外，必须验证 Decision ID 与 sourcePath 的格式；candidate 守卫接纳结构合法 scaffold，activation 守卫额外要求 body-ready。

Proves:
- 从真实 scan 获得的 scaffold candidate/established record 在身份字段有效时分别通过相应守卫；scaffold 不通过 activation 守卫，伪造的非法 ID 或非法 sourcePath 均被拒绝。
