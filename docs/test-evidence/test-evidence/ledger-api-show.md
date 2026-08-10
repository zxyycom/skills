### Case TEST-EVIDENCE-LEDGER-API-SHOW-001: Case 展示 API 重读权威 Markdown 与当前 Test
Entry:
- `tools/test-evidence/tests/ledger-api.test.ts > ledger Case show API rereads authoritative Markdown and resolves current Tests`
- `bun test --test-name-pattern="^ledger Case show API rereads authoritative Markdown and resolves current Tests$" ./tools/test-evidence/tests/run.ts`
Contract:
- show 必须用索引定位后重读 Case 权威来源，并从当前实体索引解析 Test 详情。
Proves:
- 陈旧索引回退后返回变更后的 Markdown 与 Test 集，不存在的 Case 返回结构化缺失诊断。
