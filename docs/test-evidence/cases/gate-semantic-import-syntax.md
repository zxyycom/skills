### Case GATE-SEMANTIC-IMPORT-SYNTAX-001: catalog 只采纳实际 import 语法

Tests:
- `test:a0af622c6fd8b858d884204584879352f4898fe3d08f7d4c7a4c07576d72231e`

Tags:
- `repository-tooling`

Contract:
- 语义 wrapper 的实际 static/dynamic import 应进入 catalog，注释与惰性字符串不是导入。

Proves:
- fixture 的真实两类 import 可采集，line/block comment 与普通字符串里的伪 import 不登记。
