### Case IR-RESOURCE-CLI-SIGNALS-001: 候选查询自动暴露资源风险

Tests:
- `test:f49bd3b0d6ef2b67896978d6e546a6c68d74905679488ddd58f50170aa685567`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 候选查询默认同时返回非阻断的结构化资源诊断，并让 warn 与 info 在可见输出中出现。

Proves:
- 真实 CLI 对重复文本、同字节副本与 PNG 返回相应 finding、副本体积和 image/png；stderr 包含压缩提示及图片类型，合法候选 resourceReady 仍为 true。
