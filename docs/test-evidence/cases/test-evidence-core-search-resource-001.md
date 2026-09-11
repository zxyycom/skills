### Case TEST-EVIDENCE-CORE-SEARCH-RESOURCE-001: 搜索阻断超过共享资源限额的 Case 正文

Tests:
- `test:68a2b74307f58c33d4b42318403101fc392bd5bb7bb34b2e7fca15780c79e53c`

Tags:
- `test-evidence`

Contract:
- 全文搜索不得读取超过共享文本搜索资源上限的 Case 正文后仍报告成功。

Proves:
- 含超过 2 MiB 正文的 Case 使搜索返回 search.resource-limit 诊断。
