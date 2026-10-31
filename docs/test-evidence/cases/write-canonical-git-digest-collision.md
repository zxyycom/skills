### Case WRITE-CANONICAL-CASE-011: 摘要碰撞不得合并不同字节

Tests:
- `test:0e941dcea270b21b61b7d88e38e06d18597ccb3e21e3d943a2f8cb4b90364d09`

Tags:
- `write-canonical`

Contract:
- 摘要桶碰撞不能使不同字节共享对象。

Proves:
- 强制摘要碰撞并验证各路径内容和模式。
