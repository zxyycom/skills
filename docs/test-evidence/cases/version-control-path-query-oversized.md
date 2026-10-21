### Case VERSION-CONTROL-PATH-QUERY-OVERSIZED-001: 不可分割的 Git 参数超限明确失败

Tests:
- `test:7707ca24b0d799a5d5badc0a67c3902a3829e7d60123bc580b4aa71ea384eb20`
- `test:c300aa13cac151767794086d7e087dc33fd316574b1bc016e2e007f94fb01051`

Tags:
- `version-control`

Contract:
- 固定参数或单个路径无法装入传输预算时，Git 查询在规划阶段明确失败并保留预算诊断。

Proves:
- 超长固定参数与超长单一路径分别返回可区分的预算失败诊断。
