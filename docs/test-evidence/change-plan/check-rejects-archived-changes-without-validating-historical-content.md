### Case CHANGE-PLAN-CHECK-ARCHIVED-001: Check 拒绝 Archived 且不校验历史内容
Entry:
- `tools/change-plan/tests/check.test.ts > check rejects archived changes without validating historical content`
- `bun test --test-name-pattern="^check rejects archived changes without validating historical content$" ./tools/change-plan/tests/run.ts`
Contract:
- Checker 只接受 active Change；archived Change 是历史记录，不读取或验证其 metadata 与 artifacts。
Proves:
- 缺少 design 且 metadata 无法解析的 archived 目录只返回 `archived-change-not-checkable`。
- 结果不包含 artifact 或 metadata 诊断，任务计数为零，stage、metadata 与距离为空。
