### Case LIGHTWEIGHT-JUDGMENT-CLI-001: 严格 JSON 与精度边界

Tests:
- `test:5205640aa39e400506d50d3e1e98b8be726e51e2a93602dad53351cc71102d60`

Tags:
- `lightweight-judgment`

Contract:
- JSON 不得丢失重复键、整数精度或十进制往返值；错误保留字段路径。

Proves:
- 重复与 Unicode 等义键、越界整数、下溢、负零与额外精度被拒绝，合法原生值保留。
