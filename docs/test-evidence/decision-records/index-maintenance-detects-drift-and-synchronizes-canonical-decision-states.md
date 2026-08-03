### Case DECISION-INDEX-MAINTENANCE-001: 索引维护识别漂移并同步规范状态
Entry:
- `tools/decision-records/tests/index-maintenance.test.ts > index maintenance detects drift and synchronizes canonical decision states`
- `bun test --test-name-pattern="^index maintenance detects drift and synchronizes canonical decision states$" ./tools/decision-records/tests/run.ts`
Contract:
- 常规查询必须稳定读取持久快照，严格检查必须识别来源漂移，同步必须从规范源重建状态。
Proves:
- Markdown 结构、关系或投影漂移时 list 与 trace 继续返回旧快照，严格验证产生诊断；写入同步后索引采用规范来源并再次检查通过。
