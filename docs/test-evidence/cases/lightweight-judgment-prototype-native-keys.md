### Case LIGHTWEIGHT-JUDGMENT-CLI-017: 原型外观键原生保真

Tests:
- `test:c8e56af37894f189ff8a03f60c8d1f098c4b776386b00f2f57ca3acbcf8bce36`

Tags:
- `lightweight-judgment`

Contract:
- 合法 JSON 中的 prototype、constructor、__proto__ 作为问题、候选或结构化数据 own key，必须逐值校验并原样保留。

Proves:
- 发送文本保留原型外观 state、instructions、候选与问题映射；对应有效概率和响应扩展原样保留；这些候选的非法值拒绝，ask 候选也保真。
