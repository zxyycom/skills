### Case SKILL-PACKAGE-HASH-002: 报告缺失或畸形的 skill 版本基线

Tests:
- `test:5d15ba980e28924d8f5ba425fbc89cd789df0e3e6fd504558ec3db5d8e731794`

Tags:
- `repository-tooling`

Contract:
- 版本基线修订必须存在，基线 `metadata.version` 必须为正整数字符串。

Proves:
- 缺失修订保留 `revision-not-found`，并公开 `revision-unavailable`、受控操作和目标事实；畸形版本返回明确 frontmatter 约束错误。
