### Case DECISION-CONFIGURED-ABSOLUTE-DIRECTORY-001: 来源相对路径拒绝上级目录

Tests:
- `test:89813b9e1cb9ba0fd40ff077be8d960381971415abca1f131be7acc2cea5ecd7`

Tags:
- `decision-records`

Contract:
- 工作区相对来源路径不可包含上级目录。

Proves:
- 来源层拒绝 ../record 与 a/../record，合法路径可读取受限内容。
