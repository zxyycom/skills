### Case TEST-EVIDENCE-QUERY-SHOW-001: Node CLI 返回可校验的 Case list、tags、show 与 search

Tests:
- `test:8c8f6a8b53fdeb0d4d617a024a7972756f5777a3669b4bf3ac0bd081876f5c0f`
- `test:a9d6b5c93054c9f4341a1ad4da038461eaeb626ab4d9b6cf7a4528959a630b7a`
- `test:cc32f7acee11c637e394edf39ba0a40f79f26130c2930009e7d64cd1f60cd2ac`
- `test:dea0c32faa8fd637273914bc8cb0abbbe73422f920dd972f7a3021b810f549e7`

Tags:
- `test-evidence`

Contract:
- 分发 Node CLI 的 list、tags、show 与 search 必须返回各自公开 schema 有效的 JSON，并保留 Case 查询边界。

Proves:
- 独立 Node list 节点在 tag/test 组合筛选与分页下仅返回 alpha Case。
- 独立 Node tags 节点返回 alpha 的 Case 计数 2 和 beta 的计数 1。
- 独立 Node show 节点返回 alpha Case 的权威 Markdown。
- 独立 Node search 节点按 beta tag 筛选后仅返回含权威搜索文本的 beta Case；四类输出均通过对应公开 schema 校验。
