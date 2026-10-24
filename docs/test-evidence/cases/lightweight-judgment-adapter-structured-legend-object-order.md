### Case LIGHTWEIGHT-JUDGMENT-ADAPTER-015: 结构化 legend 对象值等价

Tests:
- `test:fb885b38288d5479721d88c2d50bcc22a6584b372483c43f38cf62613302dc66`

Tags:
- `lightweight-judgment`

Contract:
- 结构化 Score legend 比较 JSON 值，不把对象 own 成员顺序作为身份；请求与服务原生响应的表示顺序保持各自原序。

Proves:
- 含嵌套对象、数字形键、原型同名 own key、数组、布尔、null 和精确数字字符串的等级在对象成员重排后单次 HTTP 成功；发送 rubric、raw result、normalized.legend 与 requestRubric 的序列化分别保持原成员序。
