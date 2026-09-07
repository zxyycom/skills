### Case INDEX-RUNTIME-SELECTED-SYNC-002: selected sync 要求合法 baseline 而全量同步可修复

Tests:
- `test:fa8a44e61b80f9b3059a8fd6ebd9f91d02bd55f7275dd39f304183987903756b`

Tags:
- `index-runtime`

Contract:
- Selected sync 只能在可信的现有完整索引上证明限定变化；全量 sync 可以从权威来源首次创建或修复 state-only snapshot。

Proves:
- 索引缺失时 selected write 返回 `selected-baseline-invalid` 且不发布，随后全量 write 成功创建索引。
