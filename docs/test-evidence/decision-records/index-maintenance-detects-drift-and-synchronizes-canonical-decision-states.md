### Case DECISION-INDEX-MAINTENANCE-001: 索引维护识别漂移并同步规范状态
Entry:
- `tools/decision-records/tests/index-maintenance.test.ts > index maintenance detects drift and synchronizes canonical decision states`
- `bun test --test-name-pattern="^index maintenance detects drift and synchronizes canonical decision states$" ./tools/decision-records/tests/run.ts`
Contract:
- 决策索引检查必须识别漂移，同步必须从规范源重建状态。
Proves:
- 漂移索引产生诊断，写入同步后再次检查通过。
