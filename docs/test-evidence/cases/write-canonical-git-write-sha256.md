### Case WRITE-CANONICAL-CASE-006: 兼容 SHA-256 对象格式

Tests:
- `test:d52d3ea3422831f9d0995053efa66ec9ebbbdd2a1648ce48f111a89dfca3123f`

Tags:
- `write-canonical`

Contract:
- Git 对象身份由仓库对象格式生成，重复字节共享对象。

Proves:
- 真实 SHA-256 仓库核对对象 ID 长度、相等性与读取内容。
