### Case TEST-EVIDENCE-KEYED-ID-001: 领域解析以 Record Key 作为权威 Case ID

Entry:
- `tools/test-evidence/tests/run.ts > domain parsing treats the record key as the authoritative case id`
- `bun test --test-name-pattern="^domain parsing treats the record key as the authoritative case id$" ./tools/test-evidence/tests/run.ts`

Contract:
- Test-evidence state parser 必须从 projection context 接收权威 case ID，并拒绝 state 内 ID 与对象键不一致。

Proves:
- 匹配的对象键与 state ID 可解析，改成另一个合法 case ID 后返回身份不一致错误。
