### Case INVESTIGATION-CANDIDATE-DISCARD-006: candidate discard rechecks Git HEAD before deletion

Tests:
- `test:40bd4f5a7d53814c97218078c3990ee9d03a3930bb9ba98df048d763d6b4309e`

Tags:
- `investigation-report`

Contract:
- `discard` 在 tombstone 移动前重新核对 candidate 与 owner resource 的 Git HEAD 记录；新进入 HEAD 的内容仍需 `--delete-recorded` 明确确认。

Proves:
- 初次检查后、删除前进入 HEAD 的 candidate 会停止事务并要求确认。
- candidate 文件未被移动或删除。
