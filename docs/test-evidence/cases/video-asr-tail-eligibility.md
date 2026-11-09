### Case VIDEO-ASR-TAIL-002: ASR 末端归一接纳边界

Tests:
- `test:24dc6b92888b3ef1b16b8bd8985bb10155b904c7bc283600ae821cd6ebd9522b`
- `test:554b7b047dd19870618a0b109b466b70a7de16d113a386e7ab65786650fb0bcc`
- `test:862cf215aa9527855cb53ffe375247ae894fd71ffcd684655b54f28d646ea373`

Tags:
- `video-understanding`

Contract:
- 排序后的唯一末条 ASR 越界且起点在媒体内时收紧终点，不设越界量上限；其他越界返回协议错误。

Proves:
- 跨多个数量级的合法尾点均登记到媒体末尾；非末条、多条、起点在末尾或其后及非 ASR 越界仍被拒绝，失败原件和可复用的旧成功材料保留。
