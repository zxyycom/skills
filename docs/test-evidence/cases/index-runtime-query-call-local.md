### Case INDEX-RUNTIME-QUERY-TRUST-003: 查询子树证明只在单次投影复用

Tests:
- `test:c3f64dad77001c6d6fd34e974f852a175cbed0352bd16ab51ece98625ef13439`

Tags:
- `index-runtime`

Contract:
- 内部独立数据副本的同次字段物化可复用校验，不跨投影复用调用方的可变状态。

Proves:
- 两次投影均限制共享关系子树的校验访问，且第二次反映调用间修改。
