### Case INVESTIGATION-CANDIDATE-DISCARD-006: candidate discard rechecks Git HEAD before deletion

Tests:
- `test:a089e0c5e892bdee5383b5dcbbece35f6b38c4a489a5705753951cdab3456652`

Tags:
- `investigation-report`

Contract:
- `discard` 在 tombstone 移动前重新核对 candidate 与 owner resource 的 Git HEAD 记录；新进入 HEAD 的内容仍需 `--delete-recorded` 明确确认。

Proves:
- 初次检查后、删除前进入 HEAD 的 candidate 会停止事务并要求确认。
- candidate 文件未被移动或删除。
