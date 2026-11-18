### Case RESOURCE-LOGICAL-ENTRY-QUERIES-001: 逻辑入口可查询并与旧精确版本共存

Tests:
- `test:e3445e30405e4f291c7952b575a499162901fee3d25b593fe931032df86a3d8a`
- `test:f53d44dde77c6230d5a31963f20646b0a72c4445422c27f1cb71eeebc1d8f990`
- `test:fe146b9a848d0e8af9a1b276b0bf2d6a4d0a24f88763cbb05858095ba4053b3b`

Tags:
- `resource-records`

Contract:
- 逻辑版本用目录和文档路径导航；可在索引中发现入口，并通过 show 回读当前逻辑记录。入口路径无需存在，内容变化不改变记录索引，旧精确版本保持原结构。

Proves:
- 入口路径未创建时，新旧记录可在同一工作区同步；list 保留逻辑入口的类型和路径，旧精确版本不出现 entries 字段。只创建入口文档和目录中的过程文件，再同步报告无变更。
- 按只存在于索引入口元数据中的文档路径搜索，结果唯一且指向该资源，命中字段包含入口路径字段。
- 同步后只修改源记录中的入口，show --version 返回新入口并标记 stale。
