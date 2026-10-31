### Case RECORD-SEARCH-OUTPUT-001: CLI 从查询结果输出六行摘要

Tests:
- `test:41f067dd01910b80fb692907f6aae06a98eb125bb7a06464bbba3c1528c0164f`
- `test:aa1bb88a21c3c2ec4fd9b50466c0283c535735558f5a6c92caa220068933b9b6`

Tags:
- `record-search`

Contract:
- 成功 search 的 stdout 先输出 Query/Filters/Source/Limits/Counts/Coverage，再输出记录或空集提示；warning 在 stderr。

Proves:
- Decision 分发模块的同进程 CLI 对 metadata 零命中查询按固定顺序输出六行，查询文本使用 JSON 转义，随后保留空集提示且 stderr 为空。
- Investigation 的同进程源码 CLI 对限量 metadata 查询输出六行摘要，matched 为精确全集、返回受限，stderr 仅报告结果数受限 warning，预览状态为 n/a。
- Investigation 的同进程源码 CLI 对 content 早停输出 matched>=N 与扫描受限，零命中仍保留六行摘要与空集提示。
