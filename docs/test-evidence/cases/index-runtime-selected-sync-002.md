### Case INDEX-RUNTIME-SELECTED-SYNC-002: selected sync 要求合法 baseline 而全量同步可修复

Tests:
- `test:d031310620f53b2f4295cd070c484681a0908ecc48b53e2271ab0fddba5d4130`

Tags:
- `index-runtime`

Contract:
- Selected sync 只能在可信的现有完整索引上证明限定变化；全量 sync 可以从权威来源首次创建或修复 state-only snapshot。

Proves:
- 索引缺失时 selected write 返回 `selected-baseline-invalid` 且不发布，随后全量 write 成功创建索引。
