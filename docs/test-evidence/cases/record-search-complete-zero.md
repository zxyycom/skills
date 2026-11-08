### Case RECORD-SEARCH-ZERO-001: 完整零命中及生效预算回显

Tests:
- `test:5a19c30cd50d868072baab139ffa1f33364f69702e9178ca299a771d4939e267`
- `test:f8b0772cfc1840c342361e4225f2475a8e1bc4c9244cce50fe9cb5b38e1de645`

Tags:
- `record-search`

Contract:
- 成功的 DR 空搜索结果有精确零计数与完整覆盖；metadata 预览不适用，content 预览完整。

Proves:
- 真实 CLI 查询未索引词得到 exact 0/returned 0、扫描与结果完整，content 预览完整并回显 20 条默认上限；metadata 预览为 null。
- 共享文件搜索另独立核对完整零命中与生效预算。
