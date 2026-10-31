### Case LIGHTWEIGHT-JUDGMENT-CLI-019: 未知 own 字段仍拒绝

Tests:
- `test:0a693aa4a067b4cdcd3b301133549aa141c31359ca8f706108efa367b18569f1`

Tags:
- `lightweight-judgment`

Contract:
- 原生开放映射可用任意 own key；配置、请求、问题与 Noul criteria 的封闭字段集合仍须严格遵守。

Proves:
- 三种原型外观未知字段在顶层、问题、Noul criteria 与配置中均拒绝；数组配置也返回 configuration/2。
