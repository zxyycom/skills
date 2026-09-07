### Case DECISION-LAYOUT-INVALID-001: 扫描器拒绝无效物理布局

Tests:
- `test:43de7f9c443eb8386055f31dca7ed9b2bbc3bcd7f18e189a66b5f6d2902b3b29`

Tags:
- `decision-records`

Contract:
- 扫描器必须同时拒绝状态与物理 sourcePath 不匹配、根目录嵌套目录以及跨位置重复 Decision ID。

Proves:
- 断言三类输入分别产生 status/sourcePath、unsupported nested directory 和 duplicate ID 诊断。
