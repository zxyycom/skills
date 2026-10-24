### Case INDEX-RUNTIME-ENVELOPE-JSON-001: 冻结 envelope 保留完整 JSON 与 own 特殊键

Tests:
- `test:2c97e521f5ffb442c65eaa305eacd3078bd9ba3e4f66234c27c223cc980defa2`

Tags:
- `index-runtime`

Contract:
- 通用 envelope 在领域 callback 前必须形成递归冻结快照，并保留标准 JSON.parse 语义和合法特殊键。

Proves:
- 完整比较嵌套对象、数组、null、false、零、空容器、负零与重复 member 最后值；own __proto__/constructor ID 和字段存在且不可写。
