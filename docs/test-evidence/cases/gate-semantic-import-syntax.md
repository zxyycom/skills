### Case GATE-SEMANTIC-IMPORT-SYNTAX-001: catalog 只采纳实际 import 语法

Tests:
- `test:3ca5987eec09be54c64e4a50f4b024091ed6ab375c7d78b0f2b5684f7b8167d4`

Tags:
- `repository-tooling`

Contract:
- 语义 wrapper 的实际 static/dynamic import 应进入 catalog，注释与惰性字符串不是导入。

Proves:
- fixture 的真实两类 import 可采集，line/block comment 与普通字符串里的伪 import 不登记。
