### Case DECISION-MEMBERSHIP-SOURCE-FACTS-001: 同阶段扫描沿用成员发现的字节与身份

Tests:
- `test:5bf4b7198e61ab917daa96b6320a010b75aa5de9fd1c6a075552c8440fe2ecdd`

Tags:
- `decision-records`

Contract:
- 同一次成员发现和扫描使用一致的来源字节与身份；后续独立发现重新读取当前来源。

Proves:
- 成员发现返回身份并保存原字节；随后改写文件不会混入该次扫描，新的独立发现则观察新身份。
