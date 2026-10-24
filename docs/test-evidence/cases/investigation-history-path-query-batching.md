### Case INVESTIGATION-HISTORY-PATH-QUERY-BATCHING-001: 历史前序按索引定位而非全集正文发现

Tests:
- `test:be30c8e31d76b394c232128d3a8c86c689c6f7e482da2ae20c85776af2d40061`

Tags:
- `investigation-report`
- `version-control`

Contract:
- 固定 HEAD 索引定位必要前序，只读取所需 payload；目录规模不扩大为全集 blob 读取。

Proves:
- 含 201 份正式来源的隔离树仍只查询索引和所需前序；源码与分发返回一致结果，真实 CLI 无历史警告且 ls-tree 请求数量与参数大小有界。
