### Case WRITE-CANONICAL-CASE-006: 兼容 SHA-256 对象格式

Tests:
- `test:4730c973e769ae2c487c3267cfca627049b19c4c89c3a43a8221877fa5abe225`

Tags:
- `write-canonical`

Contract:
- Git 对象身份由仓库对象格式生成，重复字节共享对象。

Proves:
- 真实 SHA-256 仓库核对对象 ID 长度、相等性与读取内容。
