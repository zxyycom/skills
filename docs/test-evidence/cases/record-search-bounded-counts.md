### Case RECORD-SEARCH-COUNTS-001: 首个隐藏命中的早停与末文件精确计数

Tests:
- `test:240bb720033ffe3ca825886da9faf5c2fbfa402bc9081312c1ddd74e6150c5ca`
- `test:294fed3855691a8716fac409407131237b339431050e748f86e84c7074a16ac2`
- `test:d4eb50672e28dd8dadf11cbd06cb2fe40befeb32a6869840177e907732ae832c`

Tags:
- `record-search`

Contract:
- 返回预算满后在首个隐藏命中处停止并计数；存在未扫描文件为 lower-bound，最后文件为 exact。

Proves:
- 命中数包含首个无法返回的记录，返回条数不超过预算。
- 早停分别给出扫描和返回限制，最后文件仍扫描完整但返回受限；未省略的预览保持完整。
