### Case DECISION-CLI-REMOVED-PROTOCOLS-001: CLI 拒绝已移除的拆分与位置式演进协议
Entry:
- `tools/decision-records/tests/cli-args.test.ts > decision CLI rejects removed split and positional evolve protocols`
- `bun test --test-name-pattern="^decision CLI rejects removed split and positional evolve protocols$" ./tools/decision-records/tests/run.ts`
Contract:
- 关系演进只接受统一 evolve 协议；已移除的独立 split 命令与旧位置式 evolve 参数形状必须在参数边界失败。
Proves:
- 独立 split 调用和带位置后继及旧 alignment 的 evolve 调用都退出 2。
