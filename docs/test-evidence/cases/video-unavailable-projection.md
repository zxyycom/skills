### Case VIDEO-UNAVAILABLE-PROJECTION-001: 局部不可用不传播过期正文或静默换源

Tests:
- `test:73e9e41e8a87855f7f839e6ecdda5aac19dc5ecf59dfd06d40f621eb3865ddec`
- `test:75089620d5048a213fdd89c2db1e8d2026a36445bab63271da22ec071b34971d`

Tags:
- `video-understanding`

Contract:
- 图像、支持证据或 payload 不可用时只降级受影响对象；选中来源不可用不能擅自换源，过期正文不得进入对外投影。

Proves:
- 局部故障保留其他可读材料；raw/effective 与按 ID 的 JSON/文本投影均去除不可用 OCR 和 S/C/D 的 stale 内容。
