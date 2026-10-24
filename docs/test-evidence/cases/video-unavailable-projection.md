### Case VIDEO-UNAVAILABLE-PROJECTION-001: 局部不可用不传播过期正文或静默换源

Tests:
- `test:841799d4be33ece0ee4488769c7c12f6f73374ff3c11530b68a278f62cbda3cf`
- `test:c828e35ec938cf070b2cc68a406c39ef2f4c9898480790eda689d65c6f88c800`

Tags:
- `video-understanding`

Contract:
- 图像、支持证据或 payload 不可用时只降级受影响对象；选中来源不可用不能擅自换源，过期正文不得进入对外投影。

Proves:
- 局部故障保留其他可读材料；raw/effective 与按 ID 的 JSON/文本投影均去除不可用 OCR 和 S/C/D 的 stale 内容。
