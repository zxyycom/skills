### Case GATE-LAYOUT-IDENTITIES-001: 目录身份覆盖布局新增删除重命名与类型变化

Tests:
- `test:6cb99e3c6561f8d297608b07d030acc6d9fd93d57f33b8cfe0230712f1695325`

Tags:
- `repository-tooling`

Contract:
- 结构校验输入必须覆盖技能集合与可选资源路径的存在性和文件类型，不依赖已存在入口文件内容变化。

Proves:
- 新增技能、删除入口、重命名技能目录、增加资源目录、替换为普通文件及删除资源路径，以及禁止的根状态文件新增/删除，均使 validate 重新执行。
