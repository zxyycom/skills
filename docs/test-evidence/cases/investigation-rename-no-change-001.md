### Case INVESTIGATION-RENAME-NO-CHANGE-001: 未就绪候选的同名更名无变化

Tests:
- `test:d2e7274e123d72bb36bfc9571659c924d4ce7a46104ee54fc947216a04cbac1a`

Tags:
- `investigation-report`

Contract:
- 同名候选的 no-op rename 不因不完整正文或无关损坏候选触发写入。

Proves:
- 候选正文不完整且另一个候选损坏时调用 rename 返回 unchanged，所选正文逐字保留。
