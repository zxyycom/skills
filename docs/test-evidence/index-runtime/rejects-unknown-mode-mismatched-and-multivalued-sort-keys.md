### Case INDEX-RUNTIME-QUERY-VALIDATION-001: 拒绝未知模式不匹配及多值排序键
Entry:
- `tools/index-runtime/tests/query.test.ts > rejects unknown, mode-mismatched, and multivalued sort keys`
- `bun test --test-name-pattern="^rejects unknown, mode-mismatched, and multivalued sort keys$" ./tools/index-runtime/tests/run.ts`
Contract:
- 查询必须先验证键存在、过滤模式匹配且排序键为单值。
Proves:
- 未知键、模式不匹配和多值排序分别返回错误结果。
