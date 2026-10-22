### Case DECISION-LOCAL-MAINTENANCE-CAS-001: 局部准备之后仍保护并发来源字节

Tests:
- `test:08ddc9de8a1686bc5380ca408085f8a47b5211dbb752505787743c6715492a99`

Tags:
- `decision-records`

Contract:
- 局部准备结果不授权覆盖后续来源变化，事务须锁内重验必要来源与索引。

Proves:
- 准备后注入所选正文变更，执行返回 no-change 并保持并发正文和索引原字节。
