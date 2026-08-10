### Case TEST-EVIDENCE-LEDGER-API-VALIDATE-001: 校验 API 报告稳定身份、摘要与索引诊断
Entry:
- `tools/test-evidence/tests/ledger-api.test.ts > ledger validation API reports stable source identities summaries and index diagnostics`
- `bun test --test-name-pattern="^ledger validation API reports stable source identities summaries and index diagnostics$" ./tools/test-evidence/tests/run.ts`
Contract:
- 校验 API 必须返回领域 `schemaVersion: 5`、实体身份、来源 revision、关系摘要和严格索引诊断。
Proves:
- 缺索引时仍返回实体身份、ledger source revision 和四项计数；索引同步后诊断清空，且这些来源事实保持不变。
