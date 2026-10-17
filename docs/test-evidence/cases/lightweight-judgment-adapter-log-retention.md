### Case LIGHTWEIGHT-JUDGMENT-ADAPTER-009: 多协议日志留存与拒答成功

Tests:
- `test:0fe646d23041eb16909483174d4bb710802661f79718c9800c128e6c8a8f24d4`

Tags:
- `lightweight-judgment`

Contract:
- schema v3 保留实际 wire、可选 carrier 与独立 raw 响应；正文留存开关不能被新增载体绕过，usage 按请求提取一次。

Proves:
- 四组请求／响应开关在真实临时 SQLite 上核对 adapter、两种请求表示、响应 BLOB、wire 字节与计量点；全 refusal 仍 succeeded，tokens 保留且 cost 缺失为 NULL。
