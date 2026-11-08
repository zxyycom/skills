### Case INVESTIGATION-CLI-SEARCH-FAILURE-001: 搜索缺失索引保留失败类型

Tests:
- `test:fd65ce18c71f88b9a16472c41b676428c87785cb9588e3c542b5b7e4b32d0532`

Tags:
- `investigation-report`

Contract:
- 搜索缺少索引时报告 operation failure，不伪造搜索统计。

Proves:
- 真实 CLI JSON 搜索缺失索引返回失败，error.code 为 index-not-found、failureKind 为 operation，searchInfo 为 null 且 errors 非空。
