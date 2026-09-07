### Case TEST-EVIDENCE-CORE-SEARCH-RESOURCE-001: 搜索阻断超过共享资源限额的 Case 正文

Tests:
- `test:59b6fc28622bf4c4e1a42d65b8c41a4ecff020dad2b8df9e0e1507ad54cdcdec`

Tags:
- `test-evidence`

Contract:
- 全文搜索不得读取超过共享文本搜索资源上限的 Case 正文后仍报告成功。

Proves:
- 含超过 2 MiB 正文的 Case 使搜索返回 search.resource-limit 诊断。
