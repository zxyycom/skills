### Case IR-INDEX-PAYLOAD-PRESERVATION-001: index保留未选部分暂存表示与删除

Tests:
- `test:44a32fc7f0bcb51ad84c93aa8601da57ab8eabc5673bed2e263c047f16211fa6`

Tags:
- `investigation-report`

Contract:
- IR index scope只刷新所选发布投影，不刷新未选pending来源的部分字节、模式、删除状态或未选索引含义。

Proves:
- 未选partial pending及可执行模式、另一个staged删除保持原entries；preservedPendingPaths包含二者，未选索引条目仍为旧投影。
