### Case VERSION-CONTROL-PATH-QUERY-UNION-001: Git 分批查询保留字面范围并集

Tests:
- `test:821f5ce9b83640aed63a9de211e82861fa056a46c733399ab061568086bf2009`
- `test:8bc84d5ecb6754f95962a8acc395dd7d0ae1ed12418da30b28c7ae18da53c465`
- `test:e955ccbe0b92e49c8472ca27501d4b145e3f044f81c75e307d352c2e1059dd8c`

Tags:
- `version-control`

Contract:
- Git 字面路径查询的分批属于内部传输，不扩大范围，不重复跨批重叠条目，并保留固定 revision 和指定 pending index。

Proves:
- 多批 revision 文件列表、完整内容和前缀与单目录查询等价，Trace2 显示实际启动多个有界查询。
- 多批 workspace、pending 内容和 staged 路径变化与单目录查询等价；替代 index 的选择不会回落到工作区 index。
