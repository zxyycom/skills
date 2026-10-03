### Case LIGHTWEIGHT-JUDGMENT-CLI-001: 严格 JSON 与精度边界

Tests:
- `test:6c1100db53f2276cf40ec0993255fbfe6acf177343dcaefa2feb3ef1d04b8647`

Tags:
- `lightweight-judgment`

Contract:
- JSON 不得丢失重复键、整数精度或十进制往返值；错误保留字段路径。

Proves:
- 重复与 Unicode 等义键、越界整数、下溢、负零与额外精度被拒绝，合法原生值保留。
