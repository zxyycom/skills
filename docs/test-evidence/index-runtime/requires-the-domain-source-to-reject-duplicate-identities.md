### Case INDEX-RUNTIME-IDENTITY-002: 领域来源在构造 Record 前拒绝重复身份
Entry:
- `tools/index-runtime/tests/query.test.ts > requires the domain source to reject duplicate identities`
- `bun test --test-name-pattern="^requires the domain source to reject duplicate identities$" ./tools/index-runtime/tests/run.ts`
Contract:
- 领域来源必须在构造 ID record 前发现重复身份，不能先覆盖成员再交给通用 runtime。
Proves:
- 测试证据内存来源发现重复 case ID 后使构建返回 `state-index.source-read-failed`，诊断保留领域重复身份原因。
