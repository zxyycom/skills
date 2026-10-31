### Case WRITE-CANONICAL-CASE-005: 对象去重限于单次操作

Tests:
- `test:baa000ec6bd3c7ac144af7bcce21703cfc88f2f87b50cdfa4e923ce583a32589`

Tags:
- `write-canonical`

Contract:
- 每次替换独立处理相同与不同内容，不复用跨操作状态。

Proves:
- 分别测量全相同、全不同和后续操作的 Git 启动数及字节。
