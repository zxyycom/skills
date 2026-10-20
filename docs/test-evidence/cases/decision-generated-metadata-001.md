### Case DECISION-GENERATED-METADATA-001: 生成决策 TS 闭包元数据保持可移植

Tests:
- `test:e37f04bf16fa5168eb567f8c5b01aea3c97a7283e456cca40caa61a43f929fb6`

Tags:
- `decision-records`

Contract:
- 分发 TS 必须保留维护来源与重建入口，不依赖 checkout 绝对路径；公开值仍引用同一运行实现。

Proves:
- TS 公开入口标示维护来源与重建命令、引用包内闭包且不含本机绝对路径；旧 MJS map 已移除。
- 公开 scan/rename 函数严格等于包内实际运行模块的函数引用。
