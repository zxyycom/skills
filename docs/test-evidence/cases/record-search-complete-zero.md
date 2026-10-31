### Case RECORD-SEARCH-ZERO-001: 完整零命中及生效预算回显

Tests:
- `test:00054adcfebc8a11e773ae782aa714354c5e1ce93387fa57cb00f37644c4721a`
- `test:0694f9d7a615b3db1062cb4cbd68641e51cf1726425d88e18d923955c88d44a0`
- `test:5a19c30cd50d868072baab139ffa1f33364f69702e9178ca299a771d4939e267`

Tags:
- `record-search`

Contract:
- 成功空集具有 exact 0、returned 0 和完整扫描/结果；metadata 预览不适用，content 预览完整。

Proves:
- 两个领域和共享收集器完整空集不被错误标记为截断，metadata previewsComplete=null，content 为 true。
- 结果保存生效默认资源预算、返回预算与对应来源。
