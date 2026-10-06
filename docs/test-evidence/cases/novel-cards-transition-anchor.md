### Case NOVEL-CARDS-TRANSITION-ANCHOR-031: 版本变迁查询锚点

Tests:
- `test:de4bf8aa9028ca51143aad6e0ff3035adbc5b611a81f54bdc590a4ebd2e8d642`

Tags:
- `novel-cards`

Contract:
- 当前active变迁可按自身id@N查询前后端点，旧inactive版本不因精确选择被恢复生效。

Proves:
- 当前handover@1返回两个对象变化；修订v2后旧版history为空、新版返回关系，旧版show仍可追溯。
