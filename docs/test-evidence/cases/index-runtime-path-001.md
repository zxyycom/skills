### Case INDEX-RUNTIME-PATH-001: 拒绝配置根目录之外的索引路径

Tests:
- `test:5752b904b453cdad07781143d3fcf2831818f6e9625f18ef8273765cd2b2f413`

Tags:
- `index-runtime`

Contract:
- 索引读写路径必须限制在配置根目录内。

Proves:
- 父目录逃逸路径返回 `index-path-invalid`，且主动路径语义失败不虚构 `filesystem` 事实。
