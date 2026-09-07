### Case INDEX-RUNTIME-IDENTITY-002: 领域来源在构造 Record 前拒绝重复身份

Tests:
- `test:8d6a8681799f6eadc23e41c52604e0b4e5d12f6dfbefb5f2b9cf708c7430d337`

Tags:
- `index-runtime`

Contract:
- 领域来源必须在构造 ID record 前发现重复身份，不能先覆盖成员再交给通用 runtime。

Proves:
- 测试证据内存来源发现重复 case ID 后使构建返回稳定的 `state-index.source-read-failed`；领域回调异常不是文件系统事实，诊断不附加 `filesystem`。
