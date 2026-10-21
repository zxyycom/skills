### Case DECISION-MEMBERSHIP-SOURCE-FACTS-001: 同阶段扫描沿用成员发现的字节与身份

Tests:
- `test:1cadee8d4f7c99b1fb889fee0ba37c5c3520ffc0ffcd3c362691737cfe0f6259`

Tags:
- `decision-records`

Contract:
- 同一次成员发现和扫描使用一致的来源字节与身份；后续独立发现重新读取当前来源。

Proves:
- 成员发现返回身份并保存原字节；随后改写文件不会混入该次扫描，新的独立发现则观察新身份。
