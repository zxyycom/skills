### Case WRITE-CANONICAL-CASE-012: 异步写入前隔离调用方缓冲区

Tests:
- `test:5924b690f1574da18aaa62b06fd63df8bd88fcb5b446a42b37c0d9627d40d16f`

Tags:
- `write-canonical`

Contract:
- pending 替换不得受到调用后缓冲区变更影响。

Proves:
- 调用后修改输入缓冲区，验证写入原始内容。
