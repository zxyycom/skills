### Case NOVEL-CARDS-CLI-011: CLI参数与诊断

Tests:
- `test:608f307ca9edd3a2bdef6d379622eba5adefe6319e5707d4b843415bfb9dc198`

Tags:
- `novel-cards`

Contract:
- 参数形状错误退出2且只stderr；领域失败退出1并stdout JSON及stderr诊断；只有显式同步写索引。

Proves:
- 源码入口拒绝缺write、错误命令、重复各类参数、错误参数归属、ID数量与非法预算；缺索引和未知卡报告领域错误，合法同步与边界预算展开成功，help只输出帮助。
