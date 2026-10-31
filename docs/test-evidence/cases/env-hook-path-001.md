### Case ENV-HOOK-PATH-001: Hook setup 拒绝非普通文件

Tests:
- `test:285fe8a5777d36e99b7c892eec85685cbf9b5387f1998b35f6dcc3c403febfc4`

Tags:
- `repository-tooling`

Contract:
- 仓库 setup 只能在全部受管 hook 都是普通文件时配置 `core.hooksPath`；目录或符号链接不得被当成可启用 hook。

Proves:
- 将 post-commit 路径替换为目录后，setup 返回非零并指出普通文件要求，仓库 local `core.hooksPath` 保持未配置。
