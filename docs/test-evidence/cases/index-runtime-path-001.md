### Case INDEX-RUNTIME-PATH-001: 拒绝配置根目录之外的索引路径

Tests:
- `test:cdf1f721350071fd0092ab07979332d7374cffc165ed406b529234fd5491243e`

Tags:
- `index-runtime`

Contract:
- 索引读写路径必须限制在配置根目录内。

Proves:
- 父目录逃逸路径返回 `index-path-invalid`，且主动路径语义失败不虚构 `filesystem` 事实。
