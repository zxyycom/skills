### Case TEST-EVIDENCE-CASE-ID-PATTERN-001: Case ID 使用固定协议
Entry:
- `tools/test-evidence/tests/catalog.test.ts > catalog enforces the fixed case ID pattern`
- `bun test --test-name-pattern="^catalog enforces the fixed case ID pattern$" ./tools/test-evidence/tests/catalog.test.ts`
Contract:
- 每个测试账本 case ID 必须符合工具内置且不可配置的统一格式。
Proves:
- 不符合固定格式的 case ID 产生阻断目录诊断。
