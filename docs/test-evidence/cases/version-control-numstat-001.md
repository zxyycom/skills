### Case VERSION-CONTROL-NUMSTAT-001: 严格解析 NUL numstat 记录

Tests:
- `test:de62a74dad37d2590ee7511fceee1b402dd92df4bc72d1fc97f3e60542d9a153`

Tags:
- `version-control`

Contract:
- Git numstat 解析必须以 NUL 边界保留特殊路径，只接受精确安全整数或成对二进制标记，并拒绝截断或多余记录。

Proves:
- 含制表符和换行的路径保持原值，最大安全整数精确返回，二进制计数返回 `null`。
- 缺失终止符、非规范或越界整数、混合二进制计数、缺失前缀和多余边界均返回 `operation-failed`。
