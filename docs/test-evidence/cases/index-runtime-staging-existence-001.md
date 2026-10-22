### Case INDEX-RUNTIME-STAGING-EXISTENCE-001: 选中未变化条目保持无变化

Tests:
- `test:e6a666eb452db57a15607baee3c84d5796c8d3646d4b402ad26dfb7833e51d57`

Tags:
- `index-runtime`

Contract:
- 选中 ID 的当前条目与基线相同时，选择性暂存返回无变化并保留条目。

Proves:
- 选中未变化条目后 changed=false、state=unchanged，pending 索引条目内容保持不变。
