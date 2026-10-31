### Case DR-INDEX-PAYLOAD-PENDING-RECHECK-001: index独立复核全域pending身份

Tests:
- `test:04fbbd064bee14970ed623e332db0b9c1e474980a2ef73f2ab39462948df2087`
- `test:b1f86d146db9f4f9c04dffad7b38db16f3c9af7a6e5d6d1d9ebdda7b6298fad5`
- `test:b9e18f91fe182b6365b7c6279b123022fb849a2bdbb1228d9d62c0e6c21994bf`
- `test:f71936204902af53e820112449714eabe92c1e1001470024567c70d65d797e31`

Tags:
- `decision-records`

Contract:
- index的content-paths策略不取消准备与写前之间完整pending路径、mode及OID身份保护。

Proves:
- 在独立写前读取W时改变未选OID、mode、成员增加或staged删除，stage拒绝且保留并发Git index现场。
