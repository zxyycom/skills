### Case VERSION-CONTROL-CONTENT-PAYLOAD-EMPTY-001: 空范围与选择路径生命周期

Tests:
- `test:30e9ea569940793387e9976b23a301986bdc3fa5ec9ef097914ba5dbfbe9f964`

Tags:
- `version-control`

Contract:
- content-paths允许空payload选集和当前缺失的显式路径；其授权边界内仍支持增加、删除与unchanged。

Proves:
- 空范围可增加随后删除显式所选路径并回到原快照身份；空payload选集、空updates可合法unchanged。
