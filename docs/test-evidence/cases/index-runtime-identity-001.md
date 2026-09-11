### Case INDEX-RUNTIME-IDENTITY-001: 解析 State 前拒绝非法 ID 与 Revision 成员差异

Tests:
- `test:832df0fc0f74a93bed1007721467378c1012eff850171237fca61e84f02591f4`

Tags:
- `index-runtime`

Contract:
- State record key 必须是合法稳定 ID，且 `sourceRevision.entries` 必须与 states 拥有完全相同的成员集合；两项检查先于领域解析。

Proves:
- 带空白的非法 ID 返回 `state-index.id-invalid`，revision 成员差异返回 `state-index.source-revision-members-mismatch`，两条失败路径的 state parser 调用数均为零。
