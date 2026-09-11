### Case TEST-EVIDENCE-REVISION-CASE-MOVE-001: Case 移动保留身份且只改变自身 Entry Revision

Tests:
- `test:e4d73fe6173d390f35803e09721c93da69f22b2952d6f9c492e96c7eb401ecd4`

Tags:
- `test-evidence`

Contract:
- Case revision 必须包含 sourcePath；合法移动保持 Case ID，metadata 与未移动 Case 的 revision 不变。

Proves:
- 将一个 Case 移到新的 `cases/<slug>.md` 后，其 sourcePath 和自身 revision 更新，另一个 Case 与 metadata revision 保持不变，show 仍以原 ID 返回移动后的路径。
