### Case RECORD-SEARCH-OUTPUT-001: 分发 CLI 从结果输出六行摘要

Tests:
- `test:1b90dec979a5e7d1af9bb37170149aeee3a324c9b3bbc07b61c1c7a2bcf0c75f`
- `test:7b585d56c763294b34f3b9cce481fa6e634b5b07082dd9a633e497b5fb891632`

Tags:
- `record-search`

Contract:
- 成功 search 的 stdout 先输出 Query/Filters/Source/Limits/Counts/Coverage，再输出记录或空集提示；warning 在 stderr。

Proves:
- 真实 Node 分发 CLI 按固定顺序输出六行，文本使用 JSON 转义，空集也保留摘要。
- metadata 限量为精确命中与返回受限，content 早停为 matched>=N 与扫描受限；warning 不误称预览受限，也不附泛化 collection 或 source 恢复动作。
