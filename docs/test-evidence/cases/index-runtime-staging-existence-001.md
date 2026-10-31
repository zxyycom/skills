### Case INDEX-RUNTIME-STAGING-EXISTENCE-001: 选中未变化条目保持无变化

Tests:
- `test:cf11effea3f042efbf88e782cf4187be6749fa229e5431d2cdc4234e6763b9b0`

Tags:
- `index-runtime`

Contract:
- 选中 ID 的当前条目与基线相同时，选择性暂存返回无变化并保留条目。

Proves:
- 选中未变化条目后 changed=false、state=unchanged，pending 索引条目内容保持不变。
