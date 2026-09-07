### Case INDEX-RUNTIME-FRESHNESS-001: 检测旧源并刷新变化或移除的状态

Tests:
- `test:e941142c35924acee8ab81ae76a3aa2dd5fa6816ba2f091c9d9bdd348d722333`

Tags:
- `index-runtime`

Contract:
- 源修订变化必须使旧索引失效，写同步必须完整反映更新与删除。

Proves:
- 旧索引被检测后可重建，字段修改与状态移除均进入新索引。
