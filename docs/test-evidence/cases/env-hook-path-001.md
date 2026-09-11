### Case ENV-HOOK-PATH-001: Hook setup 拒绝非普通文件

Tests:
- `test:e42099933ec19646b80eeb1e64090145ab28697132cbb8387d42340b4dc7415d`

Tags:
- `repository-tooling`

Contract:
- 仓库 setup 只能在全部受管 hook 都是普通文件时配置 `core.hooksPath`；目录或符号链接不得被当成可启用 hook。

Proves:
- 将 post-commit 路径替换为目录后，setup 返回非零并指出普通文件要求，仓库 local `core.hooksPath` 保持未配置。
