### Case INDEX-PREPARED-READER-001: reader 复用已验证快照并保留 raw 边界

Tests:
- `test:c77cecdf31b059c764b06986b94d7c8100c8e371138d8070f1da3ccc4860a939`

Tags:
- `index-runtime`

Contract:
- 严格加载形成的准备证据可供 reader 复用；raw 输入仍独立校验。

Proves:
- reader query/get/all 不增加 fixture 自有 metadata/state parser 或集合 validator 调用，prepared 交接不重新校验；raw reader/query 仍拒绝坏字段。
