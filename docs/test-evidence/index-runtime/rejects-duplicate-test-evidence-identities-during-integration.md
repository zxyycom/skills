### Case INDEX-RUNTIME-IDENTITY-002: 集成时拒绝重复测试证据标识
Entry:
- `tools/index-runtime/tests/query.test.ts > rejects duplicate test-evidence identities during integration`
- `bun test --test-name-pattern="^rejects duplicate test-evidence identities during integration$" ./tools/index-runtime/tests/run.ts`
Contract:
- 领域定义接入 runtime 后仍必须执行通用唯一标识约束。
Proves:
- 重复测试证据 case ID 在领域物化入口返回重复标识诊断。
