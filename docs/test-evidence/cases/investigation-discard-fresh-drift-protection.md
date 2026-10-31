### Case INVESTIGATION-DISCARD-FRESH-DRIFT-001: 删除共享新鲜来源仍拒绝正文与成员漂移

Tests:
- `test:9ae9bbc7624703b1ffe693b53cae98fb285a5991ddb133dc64a18f447904d614`

Tags:
- `investigation-report`
- `record-operations`

Contract:
- 单阶段来源交接不能放宽原 prepared bytes 或成员边界，fresh 中发生的外部变化必须零写入失败并保留外部 winner。

Proves:
- 在已经完成的合法 prepare 后，实际 fresh 采集时分别注入未选正文编辑或新正式成员；读取 hook 确实触发，对应来源或成员 changed 诊断拒绝 publication，待删报告和外部变更均保留。
