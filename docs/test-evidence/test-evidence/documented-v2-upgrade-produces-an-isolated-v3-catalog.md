### Case TEST-EVIDENCE-UPGRADE-V2-001: V2 Consumer 升级生成隔离的 V3 Topic Catalog
Entry:
- `tools/test-evidence/tests/run.ts > documented v2 consumer upgrade produces an isolated v3 topic catalog`
- `bun test --test-name-pattern="^documented v2 consumer upgrade produces an isolated v3 topic catalog$" ./tools/test-evidence/tests/run.ts`
Contract:
- v2 consumer 必须通过显式迁移切换到独立 v3 topic 根目录，运行时不双读旧源或扫描测试。
Proves:
- v2 配置先被拒绝；切换后 topics、sync、check、按 topic list 与 show 均成功，随后修改旧源或新增未登记测试不改变结果。
