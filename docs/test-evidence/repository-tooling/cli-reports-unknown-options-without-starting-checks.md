### Case CHECK-CLI-UNKNOWN-OPTION-001: CLI 拒绝未知选项
Entry:
- `scripts/check.test.ts > CLI reports unknown options without starting checks`
- `bun test --test-name-pattern="^CLI reports unknown options without starting checks$" ./scripts/check.test.ts`
Contract:
- 未声明的 CLI 选项不得被静默忽略。
Proves:
- 未知选项产生参数错误，且没有检查任务被执行。
