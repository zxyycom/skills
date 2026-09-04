### Case CHANGE-PLAN-CATALOG-002: Show 通过当前 checker 读取 artifacts
Entry:
- `tools/change-plan/tests/catalog.test.ts > show reads only active change artifacts through the current checker`
- `bun test --test-name-pattern="^show reads only active change artifacts through the current checker$" ./tools/change-plan/tests/run.ts`
Contract:
- Show 只面向当前 Change，返回其 checker 结果及可读取的固定 artifacts，不提供 archived raw reader。
Proves:
- 合法 Plan 的 show 结果包含当前 Change 身份、成功的 check 与可读取 proposal artifact。
