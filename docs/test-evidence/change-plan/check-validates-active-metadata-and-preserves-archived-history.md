### Case CHANGE-PLAN-CHECK-METADATA-001: 检查区分活动元数据与归档历史
Entry:
- `tools/change-plan/tests/check.test.ts > check validates active metadata and preserves archived history`
- `bun test --test-name-pattern="^check validates active metadata and preserves archived history$" ./tools/change-plan/tests/run.ts`
Contract:
- 活动 Change 必须具有符合阶段联合类型的 `.change-plan.json`，归档历史则不追补该元数据。
Proves:
- 待复核 plan 的空基线会产生阶段诊断而非格式诊断，合法搁置证据可通过，缺失或含未知字段的活动元数据被拒绝，而无元数据的归档历史保持有效。
