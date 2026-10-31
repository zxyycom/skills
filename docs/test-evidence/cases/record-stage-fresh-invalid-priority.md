### Case RECORD-STAGE-FRESH-INVALID-PRIORITY-001: fresh非法输入保留解析错误优先级

Tests:
- `test:a9baa4ea2452048052099dc2116b9fbda82bf82dc3404e75a550207dac642a09`
- `test:fceb27714eef11d79160285eedeadcfa2e56e198a47eb5507e16b7332eb4317a`

Tags:
- `index-runtime`

Contract:
- 不同fresh输入仍走原解析和领域验证，不能用快速身份冲突掩盖原边界错误。

Proves:
- 两域独立W读取时注入结构损坏P索引，保留原JSON解析失败而非pending-conflict，并保持并发Git index现场。
