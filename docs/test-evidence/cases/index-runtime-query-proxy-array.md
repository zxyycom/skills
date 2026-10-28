### Case INDEX-RUNTIME-QUERY-TRUST-004: 克隆数组代理不获得数据证明

Tests:
- `test:cbc3716d7956ab029ca56f9651ca3e414f3106c85f8e8db3122d6f882a184b9e`

Tags:
- `index-runtime`

Contract:
- 调用方 map 返回的冻结代理不能作为稳定数据副本复用校验。

Proves:
- 数据元素均合法的代理数组在第二次验证改变 every 行为时，第二字段失败。
