### Case DECISION-INDEX-DEFINITION-001: 索引拒绝旧 definitionVersion

Entry:
- `tools/decision-records/tests/layout-index.test.ts > decision index parser and check reject obsolete definition version`
- `bun test --test-name-pattern="^decision index parser and check reject obsolete definition version$" ./tools/decision-records/tests/run.ts`

Contract:
- 当前 ID 键索引只接受 definitionVersion 6，不能兼容 version 5。

Proves:
- parser 返回 error，写入 version 5 后 strict check 非零并报告版本诊断。
