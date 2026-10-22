### Case VERSION-CONTROL-CONTENT-PAYLOAD-BOUNDARY-001: payload策略与精确选集绑定

Tests:
- `test:4cca32e83fcbcb536b12a228ba65f1aac5834abc59feab4cf7034dfb6ae332dd`

Tags:
- `version-control`

Contract:
- opaque snapshot绑定repository、成员范围、payload策略及content-paths精确选集；替换不能扩大选集，删除同样受此边界约束。

Proves:
- 相同去重选集可以比较；不同策略、空选集或增加缺失路径的选集不能比较；越界内容更新和删除均拒绝且index字节不变。
