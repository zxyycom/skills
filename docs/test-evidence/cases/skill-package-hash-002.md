### Case SKILL-PACKAGE-HASH-002: 报告缺失或畸形的 skill 版本基线

Tests:
- `test:90be4e3dfb97626af82b75228d66fa4e71255ddf40204666bbb059a499e6ee04`

Tags:
- `repository-tooling`

Contract:
- 版本基线修订必须存在，基线 `metadata.version` 必须为正整数字符串。

Proves:
- 缺失修订保留 `revision-not-found`，并公开 `revision-unavailable`、受控操作和目标事实；畸形版本返回明确 frontmatter 约束错误。
