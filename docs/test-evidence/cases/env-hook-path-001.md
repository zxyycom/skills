### Case ENV-HOOK-PATH-001: Hook setup 拒绝非普通文件

Tests:
- `test:89ea7024725e10ac70c96c7c28ff9b0ad262d44e0cf623ebd14fc45d9dff5d71`

Tags:
- `repository-tooling`

Contract:
- 仓库 setup 只能在全部受管 hook 都是普通文件时配置 `core.hooksPath`；目录或符号链接不得被当成可启用 hook。

Proves:
- 将 post-commit 路径替换为目录后，setup 返回非零并指出普通文件要求，仓库 local `core.hooksPath` 保持未配置。
