### Case RECORD-STAGE-FRESH-INVALID-PRIORITY-001: fresh非法输入保留解析错误优先级

Tests:
- `test:348104d59908e7e2b739a3f71f2ef1e964e755c90920310ce49dc58158bc5db0`
- `test:6d353ffa2ba171d6e3bbdb3a7d06379430bdc0c33a4d07e8467ba5f226e7296d`

Tags:
- `index-runtime`

Contract:
- 不同fresh输入仍走原解析和领域验证，不能用快速身份冲突掩盖原边界错误。

Proves:
- 两域独立W读取时注入结构损坏P索引，保留原JSON解析失败而非pending-conflict，并保持并发Git index现场。
