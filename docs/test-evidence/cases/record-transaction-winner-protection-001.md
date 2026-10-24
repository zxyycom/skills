### Case RECORD-TRANSACTION-WINNER-PROTECTION-001: 共同恢复保护后来编辑与未写成员

Tests:
- `test:2d4c99489633593af24e8e7b41aba05f340b1b35cb30f7a77fc191e609a80287`
- `test:43a48f30865e9cfe9a9d2689064f3e5d0e9ba8f7fc061e66cd2e10df3abcba83`

Tags:
- `decision-records`
- `investigation-report`
- `record-operations`

Contract:
- CAS恢复不覆盖后来字节、inode、mode 或未写成员。

Proves:
- 分别制造外部字节、同字节新inode、chmod及未写成员变化，保留winner并返回partial-or-unknown。
