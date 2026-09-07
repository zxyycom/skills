### Case TEST-EVIDENCE-REVISION-CASE-MOVE-001: Case 移动保留身份且只改变自身 Entry Revision

Tests:
- `test:4d3270d1905360fac4e83088aba0d590eaff3b64db8d75255608dca66fb2be9b`

Tags:
- `test-evidence`

Contract:
- Case revision 必须包含 sourcePath；合法移动保持 Case ID，metadata 与未移动 Case 的 revision 不变。

Proves:
- 将一个 Case 移到新的 `cases/<slug>.md` 后，其 sourcePath 和自身 revision 更新，另一个 Case 与 metadata revision 保持不变，show 仍以原 ID 返回移动后的路径。
