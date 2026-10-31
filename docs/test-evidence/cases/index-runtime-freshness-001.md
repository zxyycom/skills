### Case INDEX-RUNTIME-FRESHNESS-001: 检测旧源并刷新变化或移除的状态

Tests:
- `test:22c2cbc96c19cbfc1510a2acf86e577a2fa77e0d9903b80ee7b41661e3794a83`

Tags:
- `index-runtime`

Contract:
- 源修订变化必须使旧索引失效，写同步必须完整反映更新与删除。

Proves:
- 旧索引被检测后可重建，字段修改与状态移除均进入新索引。
