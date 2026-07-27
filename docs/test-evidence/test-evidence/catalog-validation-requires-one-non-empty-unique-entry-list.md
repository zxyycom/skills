### Case TEST-EVIDENCE-ENTRY-LIST-001: Catalog 要求非空且唯一的 Entry
Entry:
- `tools/test-evidence/tests/run.ts > catalog validation requires one non-empty unique entry list`
- `bun test --test-name-pattern="^catalog validation requires one non-empty unique entry list$" ./tools/test-evidence/tests/run.ts`
Contract:
- 每个 case 必须且只能声明一个非空 Entry 列表，列表项不得重复。
Proves:
- 缺失 Entry 和重复 locator 都被目录校验拒绝。
