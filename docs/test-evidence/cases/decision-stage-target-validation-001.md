### Case DECISION-STAGE-TARGET-VALIDATION-001: Stage 拒绝关系目标无效的候选

Tests:
- `test:0f9b326fbe63aac893832a53a83d630c5266f1a1366eb850efe5ed15528e2de5`

Tags:
- `decision-records`

Contract:
- 候选的关系目标无效时 stage 不得写入 pending。

Proves:
- 候选引用不存在的稳定 ID 后失败且暂存区为空。
