### Case WRITE-CANONICAL-CASE-011: 摘要碰撞不得合并不同字节

Tests:
- `test:7403e4f18afe2adc16a745c6e614c9e7f7f6f7e2add40a60a957383d65f3327d`

Tags:
- `write-canonical`

Contract:
- 摘要桶碰撞不能使不同字节共享对象。

Proves:
- 强制摘要碰撞并验证各路径内容和模式。
