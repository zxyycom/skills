### Case TEST-EVIDENCE-QUERY-SHOW-001: Node CLI 返回可校验的 Case list、tags、show 与 search

Tests:
- `test:c903506fc68935cecd1eb13f216a5583b328ff46c3d48757d0e5541ccb13fb4e`

Tags:
- `test-evidence`

Contract:
- 分发 Node CLI 的 list、tags、show 与 search 必须返回各自公开 schema 有效的 JSON，并保留 Case 查询边界。

Proves:
- tag/test 筛选仅返回匹配 Case；tags 计数、show 的权威 Markdown 和带 tag 的搜索结果均与 fixture 一致。
