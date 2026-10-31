### Case WRITE-CANONICAL-CASE-012: 异步写入前隔离调用方缓冲区

Tests:
- `test:127183a6bf6941efaaa07592710664a4e5008ec5b2901863c82dbb94b9e51ded`

Tags:
- `write-canonical`

Contract:
- pending 替换不得受到调用后缓冲区变更影响。

Proves:
- 调用后修改输入缓冲区，验证写入原始内容。
