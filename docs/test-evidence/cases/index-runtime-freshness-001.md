### Case INDEX-RUNTIME-FRESHNESS-001: 检测旧源并刷新变化或移除的状态

Tests:
- `test:99633f74051fa0c9c3c4650e6f39a4d78a6186803845b4aab988e92247c24569`

Tags:
- `index-runtime`

Contract:
- 源修订变化必须使旧索引失效，写同步必须完整反映更新与删除。

Proves:
- 旧索引被检测后可重建，字段修改与状态移除均进入新索引。
