### Case RECORD-SEARCH-COUNTS-001: 首个隐藏命中的早停与末文件精确计数

Tests:
- `test:25f5df931fece097fa7868ae2065d79488b572ffab6d89ee5273d2c1f4c37af5`
- `test:479c30f2fb4505acb4f5805296ea70f61c6ff138f5d77ec0746beccd5aa2f9ae`
- `test:e4e9c6523d9342f587f0e0759bd4db193377d407dd571c3bdde7ff34511c571a`

Tags:
- `record-search`

Contract:
- 返回预算满后在首个隐藏命中处停止并计数；存在未扫描文件为 lower-bound，最后文件为 exact。

Proves:
- 命中数包含首个无法返回的记录，返回条数不超过预算。
- 早停分别给出扫描和返回限制，最后文件仍扫描完整但返回受限；未省略的预览保持完整。
