### Case INDEX-RUNTIME-PROTOCOL-001: 排序查询标量并比较有序字段定义

Tests:
- `test:926d4427f5a4940b531071bbad81ecbb50cd861ad6ce2cf59da84190c044d1be`

Tags:
- `index-runtime`

Contract:
- 查询标量具有确定的跨类型顺序；definition-owned 字段定义的相等性包含声明顺序与 mode。

Proves:
- 布尔值、数值与文本按协议排序，字段重排或 mode 改动会使定义不相等。
