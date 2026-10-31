### Case VERSION-CONTROL-CONTENT-PAYLOAD-BOUNDARY-001: payload策略与精确选集绑定

Tests:
- `test:dc330a2473c0200211895bf6be0b06266c6e858cc3e7228c2cf09ff87c8ecda2`

Tags:
- `version-control`

Contract:
- opaque snapshot绑定repository、成员范围、payload策略及content-paths精确选集；替换不能扩大选集，删除同样受此边界约束。

Proves:
- 相同去重选集可以比较；不同策略、空选集或增加缺失路径的选集不能比较；越界内容更新和删除均拒绝且index字节不变。
