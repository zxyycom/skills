### Case DECISION-CLI-DOMAIN-ARG-001: List 拒绝非法领域标识
Entry:
- `tools/decision-records/tests/cli-args.test.ts > list rejects an invalid domain identifier`
- `bun test --test-name-pattern="^list rejects an invalid domain identifier$" ./tools/decision-records/tests/run.ts`
Contract:
- List 的 domain 过滤参数只接受 kebab-case 领域 ID。
Proves:
- 带下划线和大写字母的领域 ID 使 list 退出 2 并报告 kebab-case 约束。
