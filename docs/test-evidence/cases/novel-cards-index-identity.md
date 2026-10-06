### Case NOVEL-CARDS-INDEX-IDENTITY-007: 索引不能重定向身份

Tests:
- `test:b543b7b51a34f93a7697a9c9b6b9fd144b92fb6dfa5056b7ba531d330ec7adc8`

Tags:
- `novel-cards`

Contract:
- 索引是派生定位投影，当前性指纹不能代替身份、路径、区域和标题核对。

Proves:
- 保持来源指纹但篡改投影路径、区域或标题仍失败，路径伪装selector以usage退出2。
