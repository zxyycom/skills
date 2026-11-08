### Case INVESTIGATION-CURRENT-INDEX-FAILURES-001: 列表区分缺失索引与成功结果

Tests:
- `test:374eb23f94f7ae8c430bd8dcdf9ee6859c44860d388b083d1a14d14094d997b6`

Tags:
- `investigation-report`

Contract:
- 调查列表缺失发布索引时不得返回合法空集合。

Proves:
- 真实 JSON CLI 在有效索引返回条目，使用缺失索引的目录时返回 index-not-found。
