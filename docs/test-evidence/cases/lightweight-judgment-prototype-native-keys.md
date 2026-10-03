### Case LIGHTWEIGHT-JUDGMENT-CLI-017: 原型外观键原生保真

Tests:
- `test:ad3ff2a3a3f6cf9e45ebbf60dff05db123e47b1944dce8e4a6c4b5b3f037a7df`

Tags:
- `lightweight-judgment`

Contract:
- 合法 JSON 中的 prototype、constructor、__proto__ 作为问题、候选或结构化数据 own key，必须逐值校验并原样保留。

Proves:
- 发送文本保留原型外观 state、instructions、候选与问题映射；对应有效概率和响应扩展原样保留；这些候选的非法值拒绝，ask 候选也保真。
