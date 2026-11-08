### Case DECISION-RENAME-HISTORY-001: 已记录 Decision 需要 rename 专属确认

Tests:
- `test:1c465af311b52c0329fe899ef38272b8b71b9a6eceb98f0d4396c120cfc4445d`

Tags:
- `decision-records`

Contract:
- 已记录的候选改名须显式确认。

Proves:
- 已提交候选未确认时拒绝且原字节不变，诊断提示专用确认参数；确认后改名提交。
