### Case NATIVE-SOURCE-ORDER-001: 冻结源码摘要按完整路径排序

Tests:
- `test:248fc53ebe1ddac0c970bdddcfe47b40d9a1034b8cc9f835507d528c775832ab`

Tags:
- `repository-tooling`

Contract:
- 冻结源码按完整规范相对路径排序，再以路径、长度和字节计算摘要；捕获与构建校验须使用同一顺序。

Proves:
- 同名文件和目录构成的反例 `foo.rs`、`foo/bar` 按完整路径排序并产生独立固定摘要，而不是目录遍历顺序。
