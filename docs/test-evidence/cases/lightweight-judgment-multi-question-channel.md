### Case LIGHTWEIGHT-JUDGMENT-CLI-006: 多题与固定通道

Tests:
- `test:cb20a70b12d266f9e7733714d093bac400f78036c575826345093f7ff082153d`

Tags:
- `lightweight-judgment`

Contract:
- 同 state 多题保留原生结构，单次发送固定 System One 接收端，有效响应字段完整保留。

Proves:
- Choice、Score、Noul 共用一次 POST，原生输入与凭据 header、manual redirect 正确，usage、id、provider 和扩展字段原样返回。
