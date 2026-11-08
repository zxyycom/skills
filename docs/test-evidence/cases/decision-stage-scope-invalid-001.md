### Case DECISION-STAGE-SCOPE-INVALID-001: stage rejects an invalid scope as a normal invalid argument

Tests:
- `test:3d1eb940b1f635dd6b04d7f383cc0d9e2dc5829353ea785722f2587c9baa49d0`

Tags:
- `decision-records`

Contract:
- stage 拒绝无效 scope。

Proves:
- 真实 CLI 对 `--scope everything` 返回退出码 2，工作区目录保持空。
