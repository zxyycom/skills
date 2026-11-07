### Case NATIVE-RECORD-MUTATION-SELECTED-SYNC-001: 两域选择性同步与诊断

Tests:
- `test:30f07c7631fee9029ebbd7c0b85a97d7d1006200611f408a3c452f26ed290c05`
- `test:4f87da79777d6e472ddf9fadfc5f731efdc6e73d00f36a5277ca75f7bf9cc06c`
- `test:5839a3b61a06c51c82d1195d8d53f4a77b530fefc2d6e33f41d392edf49c5d72`
- `test:7a3b87e70c0a63a4ec0883bd134083e35d22b30ca32f2f54887aef581786d725`
- `test:92bfde5a6b81d14c6a47b1744f778a9b4deea8bd7070adb342911219472b791f`
- `test:956c75b9cba5f66d0bb074f0ee9e2b88f2b489df8b3d3b190783fd7e745c06b8`
- `test:9580d92ef03ac0ef53859f10a6f0739afc1f3178c9ee80c8d2f82dac7e93f454`
- `test:c1e06c055ee6deea46caea43ab1361ef1d725f7b47b6b78269fad6745e5d12eb`
- `test:d09bd3b9a405193cf073dac0ff4d9f8cff58ad4d9b0dcb2b2f2fae998a828cdd`
- `test:fa350006323a01da258ac9f95081973ef9536283c961912a228ad714ca0becef`

Tags:
- `record-rust`

Contract:
- 选择性同步须验证完整选择及组合图，并保留未读的非目标来源。

Proves:
- 固定来源和索引核对选择错误、恢复提示、依赖与删除；decision fresh 接受同字节同权限替换并拒绝内容或权限变化。
