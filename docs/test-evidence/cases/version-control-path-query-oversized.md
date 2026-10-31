### Case VERSION-CONTROL-PATH-QUERY-OVERSIZED-001: 不可分割的 Git 参数超限明确失败

Tests:
- `test:5f0ab65dbae3e90975e094f69f264f9cc7d79e91230f24f3c4fe656922e17b83`
- `test:b75ad9a9893aaf7858d330601ff11fb58091d552f238cfb23e1a11c15a529e32`

Tags:
- `version-control`

Contract:
- 固定参数或单个路径无法装入传输预算时，Git 查询在规划阶段明确失败并保留预算诊断。

Proves:
- 超长固定参数与超长单一路径分别返回可区分的预算失败诊断。
