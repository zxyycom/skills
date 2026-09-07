### Case INVESTIGATION-CANDIDATE-DISCARD-006: candidate discard rechecks Git HEAD before deletion

Tests:
- `test:72ac62042b2905cb0fa8f492ea6ad468b9bec318503fa3ef1e2ea2b640a70bd5`

Tags:
- `investigation-report`

Contract:
- `discard-candidate` 在 tombstone 移动前重新核对 candidate 与 owner resource 的 Git HEAD 记录；新进入 HEAD 的内容仍需 `--delete-recorded-candidate` 明确确认。

Proves:
- 初次检查后、删除前进入 HEAD 的 candidate 会停止事务并要求确认。
- candidate 文件未被移动或删除。
