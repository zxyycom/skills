### Case LIGHTWEIGHT-JUDGMENT-STATS-STORED-TAGS-001: 存储 JSON 标签独立校验

Tests:
- `test:3a945b557c7363bf2e98326b512c5b47e707f725637ea17c685abaedcebcace2`

Tags:
- `lightweight-judgment`

Contract:
- SQL 日志标签按已存 JSON 对象的键和值独立验证；合法等号值和原型命名键保留，非法键不得被重解释为合法 CLI 参数。

Proves:
- 已存 suite=a=b 和 __proto__／constructor 标签可被精确筛选并原样分组；已存 bad=key 键以 storage／退出4失败、attempts为0、无 persistence 或统计结果，不改写为其他键值。
