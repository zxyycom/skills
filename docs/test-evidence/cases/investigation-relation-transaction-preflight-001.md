### Case INVESTIGATION-RELATION-TRANSACTION-PREFLIGHT-001: set-relations 预检返回完整关系核对且零写入

Tests:
- `test:116a8c6bad43e8c40cee5094b770a934941fbfda649cb3d1cfd76b4a8137ef1a`
- `test:9e5c500c4651bfeeb5aaf2bc18d6fcde89dd35cbc17b9c4c22305ae45502dca6`

Tags:
- `investigation-report`

Contract:
- `set-relations --preflight` 与 API 预检在不写入报告或索引的前提下，返回完整 before/after 集合、来源 action 和 `preflight` 阶段；正式调用重新准备后返回 `committed` 阶段。

Proves:
- API summary-only 替换的预检返回 replace action 与完整前后集合，报告和索引字节不变，随后正式执行标记为 committed。
- CLI 接受 `--preflight`、成功渲染预期 review 和摘要变化，stderr 为空且报告、索引字节未变。
