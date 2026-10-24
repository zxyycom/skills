### Case VIDEO-OCR-LOCAL-RUNTIME-001: OCR workspace 与安装清单在启动前校验

Tests:
- `test:084913a3f59cbfbaa7c9c87767144055422d126fb0a09a6a46c41c1c16a37fb3`
- `test:2c563a8bc6c7b2f62757c4e4cde29ee5f6c6625b0d125c21227345d2d039f441`

Tags:
- `video-understanding`

Contract:
- 各 OCR 操作拥有独立 workspace；工具槽、profile、固定模型清单和 SHA-256 必须在启动前有效。

Proves:
- 媒体与 OCR workspace 可共存但同工具 workspace 不复用；缺槽、缺模型、损坏 hash 和逃逸程序路径在任何原生识别前被拒绝。
