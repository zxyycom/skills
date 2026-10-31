### Case RECORD-STAGE-BYTE-EQUIVALENCE-001: 字节变化不能以解码相同复用解析

Tests:
- `test:886d7df2a05f60936a47db163695ffb79119927109fd12de03455bf58bd5046c`
- `test:e0d289c126efa02be0d3de8f2223150f84c390688ec6859e93190689e6e1852a`

Tags:
- `index-runtime`

Contract:
- 去重证明使用实际字节，不使用UTF8解码后文本或规范化投影代替原始字节等价。

Proves:
- 两域准备后给W添加UTF8 BOM，真实W仍读取两次且解析两次；等价投影按原行为成功，最终所选pending正确。
