### Case RECORD-SEARCH-OUTPUT-001: CLI 从查询结果输出六行摘要

Tests:
- `test:1b90dec979a5e7d1af9bb37170149aeee3a324c9b3bbc07b61c1c7a2bcf0c75f`
- `test:7bc66f5fdb7005180189e7d1613c095729ec3db8a53d3472c899332f0de8f02b`

Tags:
- `record-search`

Contract:
- 成功 search 的 stdout 先输出 Query/Filters/Source/Limits/Counts/Coverage，再输出记录或空集提示；warning 在 stderr。

Proves:
- Decision 分发模块的同进程 CLI 对 metadata 零命中查询按固定顺序输出六行，查询文本使用 JSON 转义，随后保留空集提示且 stderr 为空；不验证 Node 子进程。
- Investigation 的同进程源码 CLI 对限量 metadata 查询输出六行摘要，matched 为精确全集、返回受限，warning 只写 stderr 且不误称预览受限或要求泛化修复。
- Investigation 的同进程源码 CLI 对 content 早停输出 matched>=N 与扫描受限，零命中仍保留六行摘要与空集提示；该入口不启动 Node 子进程。
