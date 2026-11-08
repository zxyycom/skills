### Case DECISION-SEARCH-FALLBACK-001: 发布范围内读取当前正文

Tests:
- `test:f8b0772cfc1840c342361e4225f2475a8e1bc4c9244cce50fe9cb5b38e1de645`

Tags:
- `decision-records`

Contract:
- content 按发布索引范围读取当前正文，不隐式同步索引。

Proves:
- 真实 CLI 在已索引正文手改后命中新正文词，保留原索引字节；缺索引时失败，不生成成功 searchInfo。
