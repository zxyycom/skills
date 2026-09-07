### Case INDEX-RUNTIME-PROTOCOL-001: 排序查询标量并比较有序字段定义

Tests:
- `test:39c5ecabc373978cbe782c79c3ec462ad50bf6de680c4f817fdae8e67f534442`

Tags:
- `index-runtime`

Contract:
- 查询标量具有确定的跨类型顺序；definition-owned 字段定义的相等性包含声明顺序与 mode。

Proves:
- 布尔值、数值与文本按协议排序，字段重排或 mode 改动会使定义不相等。
