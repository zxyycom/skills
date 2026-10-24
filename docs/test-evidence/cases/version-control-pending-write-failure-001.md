### Case VERSION-CONTROL-PENDING-WRITE-FAILURE-001: pending 写前故障保留原范围与净化诊断

Tests:
- `test:6388805f081f7abbacc23e3530dd3943cab4965cda6420ba5ed36716eec96230`

Tags:
- `version-control`

Contract:
- pending 范围写入失败不能留下部分目标；共享层只报告它能证明的替换 event、系统原因、受控范围和进程内 cause，不推断上层事务 outcome。

Proves:
- pending prewrite 故障后原范围内容不变且错误诊断净化；不把未发生的实际写入称为写后恢复，readback 恢复由独立入口证明。
