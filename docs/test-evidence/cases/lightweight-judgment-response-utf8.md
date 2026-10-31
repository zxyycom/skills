### Case LIGHTWEIGHT-JUDGMENT-CLI-016: 网络响应 UTF-8 边界

Tests:
- `test:ade78700201fcee7366bd5b1c7d53a79c0f9e7393bfa38fae81d125f7e990eab`

Tags:
- `lightweight-judgment`

Contract:
- 响应正文必须以 fatal UTF-8 解码；坏编码是 invalid_response，读取失败是 network。

Proves:
- 合法协议正文中的 0xff 被拒绝并保留 HTTP 200，真正 U+FFFD 保留成功，正文 stream 失败单独映射为 network。
