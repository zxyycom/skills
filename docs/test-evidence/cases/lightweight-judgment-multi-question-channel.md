### Case LIGHTWEIGHT-JUDGMENT-CLI-006: 多题与默认通道

Tests:
- `test:59f02a549c107199d211dd11369db7bb7ded82bad4bc6671236123d86582e150`

Tags:
- `lightweight-judgment`

Contract:
- 同 state 多题保留原生结构，默认单次发送 OpenRouter System One 接收端，有效响应字段完整保留。

Proves:
- Choice、Score、Noul 共用一次 POST，原生输入与凭据 header、manual redirect 正确，usage、id、provider 和扩展字段原样返回。
