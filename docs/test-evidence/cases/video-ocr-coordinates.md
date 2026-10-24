### Case VIDEO-OCR-COORDINATES-001: OCR 结果保持像素坐标与 ROI 契约

Tests:
- `test:280c36fa90c97a2a3da6747f64f245d85347c8935208f95eb79ed666b508d533`
- `test:4c0fb2193a41847d44dc98886e9bc3360412e58185bcf0bbda1f8158ea2c4d89`
- `test:e9f4904af2bcc026880a6604a619e9c6da2aefb09767d198002d2be65bb75f89`

Tags:
- `video-understanding`

Contract:
- OCR boxes、region 和 transform 使用原 PNG 坐标，ROI 不能截断、舍入或越界；VideOCR 参数保持指定单 ROI 离线 CPU 行为。

Proves:
- 合法框和真实空结果保留，数组/坐标不一致与非法 ROI 被拒绝；原生参数不启用简繁转换、GPU 或 debug images。
