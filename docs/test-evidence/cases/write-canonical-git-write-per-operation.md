### Case WRITE-CANONICAL-CASE-005: 对象去重限于单次操作

Tests:
- `test:c2cdd48576366c850acac7112ffd8f6052c1d411b3a7fcf776303ee5c01a9361`

Tags:
- `write-canonical`

Contract:
- 每次替换独立处理相同与不同内容，不复用跨操作状态。

Proves:
- 分别测量全相同、全不同和后续操作的 Git 启动数及字节。
