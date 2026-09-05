### Case DECISION-INDEX-MAINTENANCE-001: 索引维护识别漂移并同步规范状态
Entry:
- `tools/decision-records/tests/index-maintenance.test.ts > index maintenance detects drift and synchronizes canonical decision states`
- `bun test --test-name-pattern="^index maintenance detects drift and synchronizes canonical decision states$" ./tools/decision-records/tests/run.ts`
Contract:
- 常规查询必须稳定读取当前持久快照，严格检查必须识别 ID-keyed state、独立 sourcePath、结构化 revision 与标签投影漂移，同步必须从规范 Markdown 重建状态。
Proves:
- 旧 definition、非法 entry fingerprint、state/sourcePath 与 Markdown 声明不一致及标签字段篡改均被严格验证拒绝。
- Markdown 结构、关系或投影漂移时 list 与 trace 继续返回旧快照；写入同步后 schema v4 state-only 索引采用规范来源并再次检查通过。
