### Case LIGHTWEIGHT-JUDGMENT-ADAPTER-016: 结构化 legend 的数组与值边界

Tests:
- `test:293f37a442537dae50a3d6428b788ed0a3e239030b3056e37bf242c38e6f60b5`

Tags:
- `lightweight-judgment`

Contract:
- legend 对象成员可重排，但对象 own key 集合、值类型与值、数组成员位置和长度必须一致，不能排序或降精度掩盖差异。

Proves:
- 嵌套数值、null/boolean 类型、缺失或额外 own key、精确数字字符串、数组顺序或长度发生变化时，单次 HTTP 返回 invalid_response/3、attempts=1 和 null result。
