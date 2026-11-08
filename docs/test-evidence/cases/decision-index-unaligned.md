### Case DECISION-INDEX-UNALIGNED-001: 未对齐是合法正式状态

Tests:
- `test:398e9d0f7d82933d4600f613a50fa29cf9016eccf39ca0dc81e15d0e6d53b0be`
- `test:4d2e3199bed9cd8bfa4623a8b3c1e917c7481ca1f535ade9c271cdc2681670ac`

Tags:
- `decision-records`

Contract:
- 未对齐是合法正式状态。

Proves:
- 真实原生 CLI 读取 archived/unaligned 索引成功；另一个 fixture 对匹配 active/unaligned 来源及索引的严格 check 成功。
