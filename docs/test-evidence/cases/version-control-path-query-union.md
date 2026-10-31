### Case VERSION-CONTROL-PATH-QUERY-UNION-001: Git 分批查询保留字面范围并集

Tests:
- `test:8de67bfa22f77cd76b6a024a95d4c948a344d73d49880b020c043a05c880c19c`
- `test:8ec6b32ff7cb73d635d55e29fd08d076069406675269aa796c72200df908f1fa`
- `test:f792fbad35eb92fcfc0e5748ec0f07bbbedb53328ba15d5d4129b518b204eb04`

Tags:
- `version-control`

Contract:
- Git 字面路径查询的分批属于内部传输，不扩大范围，不重复跨批重叠条目，并保留固定 revision 和指定 pending index。

Proves:
- 多批 revision 文件列表、完整内容和前缀与单目录查询等价，Trace2 显示实际启动多个有界查询。
- 多批 workspace、pending 内容和 staged 路径变化与单目录查询等价；替代 index 的选择不会回落到工作区 index。
