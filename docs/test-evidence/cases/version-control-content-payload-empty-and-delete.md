### Case VERSION-CONTROL-CONTENT-PAYLOAD-EMPTY-001: 空范围与选择路径生命周期

Tests:
- `test:b1fae54a0fada9e34cd556e15c86b07b28dc0020730fe4133d7f76b4bc17fd57`

Tags:
- `version-control`

Contract:
- content-paths允许空payload选集和当前缺失的显式路径；其授权边界内仍支持增加、删除与unchanged。

Proves:
- 空范围可增加随后删除显式所选路径并回到原快照身份；空payload选集、空updates可合法unchanged。
