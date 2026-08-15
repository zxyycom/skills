### Case DECISION-STAGE-PENDING-CAS-001: Stage 保留并发 pending 内容

Entry:
- `tools/decision-records/tests/stage.test.ts > stage preserves concurrent pending bytes discovered by the replacement CAS`
- `bun test --test-name-pattern="^stage preserves concurrent pending bytes discovered by the replacement CAS$" ./tools/decision-records/tests/run.ts`

Contract:
- Stage 的预检与 pending 替换之间若出现并发 pending 文件，锁内 CAS 必须拒绝替换，不能覆盖他人的暂存字节。

Proves:
- 在构造目标后注入并暂存另一份决策，stage 报告冲突，且该暂存文件字节保持不变。
