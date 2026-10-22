### Case RECORD-STAGE-BYTE-EQUIVALENCE-001: 字节变化不能以解码相同复用解析

Tests:
- `test:87b65ab932ac5be05b592e5cb041c9ca344ada7c7ebad7fbf7d7e0a41ee5e37a`
- `test:9b7bd207fa6ec01e48d98f4238d96aa54e730b84d5f741bff5508ff789819713`

Tags:
- `index-runtime`

Contract:
- 去重证明使用实际字节，不使用UTF8解码后文本或规范化投影代替原始字节等价。

Proves:
- 两域准备后给W添加UTF8 BOM，真实W仍读取两次且解析两次；等价投影按原行为成功，最终所选pending正确。
