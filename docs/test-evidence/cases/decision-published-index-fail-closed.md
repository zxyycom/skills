### Case DECISION-PUBLISHED-INDEX-FAIL-CLOSED-001: 发布索引严格验收与按依赖验图

Tests:
- `test:75fdc6ee2ba3a59d488880ee86fad1d769471680fe505941c35d40db064e1c65`

Tags:
- `decision-records`

Contract:
- 纯索引查询严格验证结构与 definition；只有关系依赖才验完整领域图，索引异常不降级。

Proves:
- JSON 损坏、definition 不兼容与索引缺失使 list、trace、metadata search 失败；合法结构但缺失关系 target 时 list、metadata 成功而 trace 失败，无来源降级或合法空伪成功。
