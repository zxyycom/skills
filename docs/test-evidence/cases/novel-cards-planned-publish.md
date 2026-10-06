### Case NOVEL-CARDS-PLANNED-PUBLISH-030: 预期作者修订发布边界

Tests:
- `test:1dc804bc7fc065f21154973a842c7c12a0e63413b9b6695c369b090209814621`

Tags:
- `novel-cards`

Contract:
- expected作者修订不能批量更新对象，即使新对象声明occurred。

Proves:
- 输入新人物/设定均为occurred的预期修订仍失败，旧索引字节和两个当前v1对象完全不变。
