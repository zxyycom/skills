### Case GATE-LAYOUT-IDENTITIES-001: 目录身份覆盖布局新增删除重命名与类型变化

Tests:
- `test:9a8ea1a0073c817fb7225348745edd63be4ead493d02415ab8d7c81d8992b41e`

Tags:
- `repository-tooling`

Contract:
- 结构校验输入必须覆盖技能集合与可选资源路径的存在性和文件类型，不依赖已存在入口文件内容变化。

Proves:
- 新增技能、删除入口、重命名技能目录、增加资源目录、替换为普通文件及删除资源路径，以及禁止的根状态文件新增/删除，均使 validate 重新执行。
