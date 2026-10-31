### Case INVESTIGATION-RELATION-TRANSACTION-PREFLIGHT-001: set-relations 预检返回完整关系核对且零写入

Tests:
- `test:08646fe1314d62b1814b24189ba9d8048094637e68d009c0ee4b8c1ef762204d`
- `test:8e1dc7b82dafaa66855f917e9f45910e9439099140ed5afaca1b91047c1d2f53`

Tags:
- `investigation-report`

Contract:
- `set-relations --preflight` 与 API 预检在不写入报告或索引的前提下，返回完整 before/after 集合、来源 action 和 `preflight` 阶段；正式调用重新准备后返回 `committed` 阶段。

Proves:
- API summary-only 替换的预检返回 replace action 与完整前后集合，报告和索引字节不变，随后正式执行标记为 committed。
- CLI 接受 `--preflight`、成功渲染预期 review 和摘要变化，stderr 为空且报告、索引字节未变。
