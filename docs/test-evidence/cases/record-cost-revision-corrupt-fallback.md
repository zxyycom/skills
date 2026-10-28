### Case RECORD-COST-CASE-002: 损坏对象按需失败

Tests:
- `test:19d41c676b87a7ca0492dc39ff98e6b106b6ab3697e1eac531fbaae743cb1aac`

Tags:
- `record-cost`

Contract:
- 未消费的损坏对象不得使已消费路径失败。

Proves:
- 损坏后项触发回退，前项成功、后项报对应错误。
