### Case DECISION-RECORD-GUARD-IDENTITY-001: Record 类型守卫拒绝无效身份字段

Tests:
- `test:ed55d834488b879dd65d7f8d3d483edf0cafb6eb3b6a738bd468316133409305`

Tags:
- `decision-records`

Contract:
- 公开的 candidate、established 和 activation record 类型守卫除 source kind 外，必须验证 Decision ID 与 sourcePath 的格式；candidate 守卫接纳结构合法 scaffold，activation 守卫额外要求 body-ready。

Proves:
- 来源扫描器解析内存 Markdown 得到 body-ready candidate 与 established record，分别通过 candidate/activation 和 established 守卫；将 Decision ID 或 sourcePath 改为非法值后，对应守卫均拒绝。
