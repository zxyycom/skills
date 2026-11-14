### Case RESOURCE-LINEAGE-CASE-001: 候选与输入溯源

Tests:
- `test:4ecf1924b12fab9089aeb11ac06058f370b9629b488ec1f55ed41d8dbf2e2da0`
- `test:ef6611c63a93826434029206bb5969662beb163166cc50ad8682edfc9635c581`

Tags:
- `resource-records`

Contract:
- 候选版本不自动改变选用；有序输入与图包别名保留精确来源，未知终点不伪造已登记关系。

Proves:
- 两候选追到同一底图而选用不变；输入顺序、别名解析、下游查询及未知终点的值和计数可观察。
