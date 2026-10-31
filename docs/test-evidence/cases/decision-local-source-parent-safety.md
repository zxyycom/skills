### Case DECISION-LOCAL-SOURCE-PARENT-SAFETY-001: 局部操作拒绝archive符号链接目录

Tests:
- `test:91a40886ff74ded41d29eafd2b551cbfe801360a896b2961f002ca12cb5dbcba`

Tags:
- `decision-records`

Contract:
- 局部来源读取和写入不得通过受管 archive 符号链接越过来源目录边界。

Proves:
- 发布路径指向符号链接 archive 时，all stage 与 reactivate 均拒绝，外部正文和 pending tree 均不变。
