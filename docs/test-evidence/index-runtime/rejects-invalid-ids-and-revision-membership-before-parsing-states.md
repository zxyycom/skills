### Case INDEX-RUNTIME-IDENTITY-001: 解析 State 前拒绝非法 ID 与 Revision 成员差异
Entry:
- `tools/index-runtime/tests/protocol.test.ts > rejects invalid ids and revision membership before parsing states`
- `bun test --test-name-pattern="^rejects invalid ids and revision membership before parsing states$" ./tools/index-runtime/tests/run.ts`
Contract:
- State record key 必须是合法稳定 ID，且 `sourceRevision.entries` 必须与 states 拥有完全相同的成员集合；两项检查先于领域解析。
Proves:
- 带空白的非法 ID 返回 `state-index.id-invalid`，revision 成员差异返回 `state-index.source-revision-members-mismatch`，两条失败路径的 state parser 调用数均为零。
