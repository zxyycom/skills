### Case DECISION-TYPE-PATH-001: 决策类型与路径保持身份不变量
Entry:
- `tools/decision-records/tests/type-path-invariants.test.ts > decision types and paths preserve identity and alignment invariants`
- `bun test --test-name-pattern="^decision types and paths preserve identity and alignment invariants$" ./tools/decision-records/tests/run.ts`
Contract:
- 决策 ID、类型、domain 与文件路径必须相互对齐。
Proves:
- 不匹配身份被拒绝，合法路径可稳定还原决策身份。
