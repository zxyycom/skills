### Case VIDEO-OCR-LOCAL-RUNTIME-001: OCR workspace 与安装清单在启动前校验

Tests:
- `test:c1cdf004409a9c0a55eab3bf9ca163b4da33a2616e9cb4f7ef4e1a2ce64ff75c`
- `test:ef6a003a4891c486e9df923bf1d52ed24c25f142c5b79d5d7bdc4fce2d18f35d`

Tags:
- `video-understanding`

Contract:
- 各 OCR 操作拥有独立 workspace；工具槽、profile、固定模型清单和 SHA-256 必须在启动前有效。

Proves:
- 媒体与 OCR workspace 可共存但同工具 workspace 不复用；缺槽、缺模型、损坏 hash 和逃逸程序路径在任何原生识别前被拒绝。
