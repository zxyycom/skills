### Case DECISION-LOCAL-SOURCE-PARENT-SAFETY-001: 拒绝 archive 父目录符号链接越界

Tests:
- `test:1ce5e564226638a7e48974fc3df046f68b94dc58a7a5c47034ebe3fbf4dc3207`

Tags:
- `decision-records`

Contract:
- 局部来源读取和写入不得通过受管 archive 符号链接越过集合边界。

Proves:
- 将已建立来源的 archive 目录替换为指向外部临时目录的符号链接，真实 reactivate CLI 因来源路径越界失败；外部正文与索引字节不变、符号链接保留。此节点不单独验证 Git pending tree 或 stage。
