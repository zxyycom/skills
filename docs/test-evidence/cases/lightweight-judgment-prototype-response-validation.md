### Case LIGHTWEIGHT-JUDGMENT-CLI-018: 响应 own key 不得被清洗

Tests:
- `test:c30ea4ef997832adbb0d3ca0752ff36a405b7c0e1235b2aede5c1d9923cbf64f`

Tags:
- `lightweight-judgment`

Contract:
- 概率与 legend 必须针对完整原始 own key 集合及所有值校验，不能由 Schema 过滤键后产生成功。

Proves:
- 三种原型外观额外键在 Choice、Score 概率与 Score legend 中均拒绝；额外零值、非归一值、布尔、字符串、null 与对象都不能绕过校验。
