### Case SKILL-PACKAGE-HASH-002: 报告缺失或畸形的 skill 版本基线

Tests:
- `test:685b73e42598dfd0889acf49d123c74366aa465ef458676f37814e2dcbacf5a8`

Tags:
- `repository-tooling`

Contract:
- 版本基线修订必须存在，基线 `metadata.version` 必须为正整数字符串。

Proves:
- 缺失修订保留 `revision-not-found`，并公开 `revision-unavailable`、受控操作和目标事实；畸形版本返回明确 frontmatter 约束错误。
