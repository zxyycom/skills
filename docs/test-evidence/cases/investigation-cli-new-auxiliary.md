### Case INVESTIGATION-CLI-NEW-AUXILIARY-001: 辅助预检不可用不撤销候选创建成功

Tests:
- `test:22aed34ba8dfc53f3ba1f6bece194ca75a81159f716747940748c7130cf0cd61`

Tags:
- `investigation-report`

Contract:
- new 已成功创建候选后，辅助 publish preflight 的读取失败独立报告，不把创建改判为失败或要求重建。

Proves:
- 创建摘要之后注入集合读取失败，CLI 仍退出 0，stdout 明确完整 ID、预检 unavailable 与 candidate remains created。
- stderr 包含独立 auxiliary 诊断，磁盘仍保留原历史日期 ID 的候选。
