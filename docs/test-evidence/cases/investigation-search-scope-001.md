### Case INVESTIGATION-SEARCH-SCOPE-001: 搜索缺失索引不伪造结果

Tests:
- `test:fd65ce18c71f88b9a16472c41b676428c87785cb9588e3c542b5b7e4b32d0532`

Tags:
- `investigation-report`

Contract:
- 缺失索引时 content 搜索明确失败，不报告成功搜索信息。

Proves:
- 真实 CLI 搜索返回 index-not-found、operation failure，searchInfo 为 null。
