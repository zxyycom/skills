### Case INDEX-RUNTIME-QUERY-TRUST-004: 克隆数组代理不获得数据证明

Tests:
- `test:6ef53d7a5ef0db4c6b11971fdd86f34775cda65e2611b77f31603bb5a979ad93`

Tags:
- `index-runtime`

Contract:
- 调用方 map 返回的冻结代理不能作为稳定数据副本复用校验。

Proves:
- 数据元素均合法的代理数组在第二次验证改变 every 行为时，第二字段失败。
