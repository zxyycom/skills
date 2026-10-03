### Case RECORD-SEARCH-ZERO-001: 完整零命中及生效预算回显

Tests:
- `test:287807dfc30240d25db39614bb2e78e044cf19235e2af3108c0c9c8420fe9cca`
- `test:3c08c41ec0af2c00fbc965bceee9b941175277e839fb77854dff602dfa9f575c`
- `test:f58099494d895713ad49c097263a3e3b64503b30fc02821e37261b14c9e23b0b`

Tags:
- `record-search`

Contract:
- 成功空集具有 exact 0、returned 0 和完整扫描/结果；metadata 预览不适用，content 预览完整。

Proves:
- 两个领域和共享收集器完整空集不被错误标记为截断，metadata previewsComplete=null，content 为 true。
- 结果保存生效默认资源预算、返回预算与对应来源。
