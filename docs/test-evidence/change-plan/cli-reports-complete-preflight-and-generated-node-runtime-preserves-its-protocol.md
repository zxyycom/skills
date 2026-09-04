### Case CHANGE-PLAN-CLI-002: CLI 与生成 Node runtime 保持 complete preflight 协议
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI reports complete preflight and generated Node runtime preserves its protocol`
- `bun test --test-name-pattern="^CLI reports complete preflight and generated Node runtime preserves its protocol$" ./tools/change-plan/tests/run.ts`
Contract:
- 源码 CLI 和生成 MJS 对 complete preflight 使用相同 JSON 与退出协议。
Proves:
- 两个入口都以成功退出并返回 `outcome: "preflight"`、`changed: false`。
