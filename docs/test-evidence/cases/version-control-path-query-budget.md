### Case VERSION-CONTROL-PATH-QUERY-BUDGET-001: Git 参数预算计入编码与固定开销

Tests:
- `test:1a8c1107f76b7bcc20b95b380b3f9b36bdfe81a66414096870085fc9349ef388`

Tags:
- `version-control`

Contract:
- Git 私有路径批次按编码与转义后的参数开销规划，保守计入可执行文件、固定参数、UTF-8 字节和 Windows 引号转义。

Proves:
- 含中文、非 BMP 字符和引号的路径被稳定分批；每批保守 Windows 与 UTF-8 开销均不超过 28,000，且没有丢失或拆散路径。
