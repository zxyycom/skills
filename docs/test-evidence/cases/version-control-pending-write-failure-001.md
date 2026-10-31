### Case VERSION-CONTROL-PENDING-WRITE-FAILURE-001: pending 写前故障保留原范围与净化诊断

Tests:
- `test:03d0f8a189b6d797431dac748948c30022c6f04ef013ecfad123031faa5105b6`

Tags:
- `version-control`

Contract:
- pending 范围写入失败不能留下部分目标；共享层只报告它能证明的替换 event、系统原因、受控范围和进程内 cause，不推断上层事务 outcome。

Proves:
- pending prewrite 故障后原范围内容不变且错误诊断净化；本入口注入点为 pending 写入前，readback 恢复由独立入口证明。
