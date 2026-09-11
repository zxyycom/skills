### Case REPO-SKILL-HASH-002: Runtime and declaration semantic changes require a version

Tests:
- `test:3433b679fec452a96dbabc642bae4f77c9779e87cff31c6be1e9795c5c03dcc6`

Tags:
- `repository-tooling`

Contract:
- 运行时 `.mjs` 内容变化，以及已有 `.d.mts` 声明的语义变化，仍然承载 skill 版本。

Proves:
- 与注入基线比较时，当前内存 snapshot 中的两类变化在未提升 metadata.version 时都会产生版本门禁诊断。
