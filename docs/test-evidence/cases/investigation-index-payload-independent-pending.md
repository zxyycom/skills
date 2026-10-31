### Case IR-INDEX-PAYLOAD-PENDING-RECHECK-001: index独立写前复核全域pending身份

Tests:
- `test:09ce4ebd776b1367c3c7b102094775e68c886be424a008cabb70a55835ec2df0`
- `test:4e833c7700b63929d2e28a185da71890859fd0b17856999c4e79803e2f9e3322`
- `test:c1ca733c0b182b91d5e854eab695ce817e57ffb1af07f1b39ba10fd25cb7dbbc`
- `test:de670c6fce59b392012efad14bcccc0ca00a6a4d0a9bf243287e79c690219864`

Tags:
- `investigation-report`

Contract:
- IR index准备阶段复用初始pending，不取消独立写前全域pending路径、模式与OID身份复核。

Proves:
- 初始快照取得后、独立写前 phase 前改变未选 OID、mode、成员增加或 staged 删除，stage 返回 pending-conflict 且保留并发 index 现场。
