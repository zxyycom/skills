### Case RECORD-TRANSACTION-WINNER-PROTECTION-001: 共同恢复保护后来编辑与未写成员

Tests:
- `test:a0be876b3aedf5041599e71ce43bae1266c07f7cf81f28234dc35bc394d3fd8a`

Tags:
- `decision-records`
- `investigation-report`
- `record-operations`

Contract:
- CAS恢复不覆盖后来字节、inode、mode 或未写成员。

Proves:
- 分别制造外部字节、同字节新inode、chmod及未写成员变化，保留winner并返回partial-or-unknown。
