### Case DECISION-LOCAL-SOURCE-PARENT-SAFETY-001: 局部操作拒绝archive符号链接目录

Tests:
- `test:fd1dfc9e7e3093b2afbeeea85a92a74550c5246dccef6f7e29ce55388d88fbb7`

Tags:
- `decision-records`

Contract:
- 局部来源读取和写入不得通过受管 archive 符号链接越过来源目录边界。

Proves:
- 发布路径指向符号链接 archive 时，all stage 与 reactivate 均拒绝，外部正文和 pending tree 均不变。
