### Case VIDEO-ASR-TAIL-002: ASR 末端归一接纳边界

Tests:
- `test:0b47b60d37f12aca044a48f5127250b65d79dbf3515c1f9740253339f71b91b5`
- `test:6eb2b8fa67472135686949a49fe35cfa86e757134f94bfe9012f68c1c294b8bf`
- `test:b614c10451f12ab04fccebf42c368fd308e1ceeca48fad840d0e1ac216c8eac0`

Tags:
- `video-understanding`

Contract:
- 排序后的唯一末条 ASR 越界且起点在媒体内时收紧终点，不设越界量上限；其他越界返回协议错误。

Proves:
- 跨多个数量级的合法尾点均登记到媒体末尾；非末条、多条、起点在末尾或其后及非 ASR 越界仍被拒绝，失败原件和可复用的旧成功材料保留。
