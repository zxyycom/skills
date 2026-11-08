### Case RECORD-SEARCH-FALLBACK-001: 发布索引不可用时明确失败

Tests:
- `test:f8b0772cfc1840c342361e4225f2475a8e1bc4c9244cce50fe9cb5b38e1de645`
- `test:fd65ce18c71f88b9a16472c41b676428c87785cb9588e3c542b5b7e4b32d0532`

Tags:
- `record-search`

Contract:
- content 查询要求已发布索引，不隐式重建来源。

Proves:
- DR 真实 CLI 缺索引时返回 index-not-found、无 searchInfo 且不创建索引；IR 真实 CLI 缺索引亦报操作失败、不制造 searchInfo。
