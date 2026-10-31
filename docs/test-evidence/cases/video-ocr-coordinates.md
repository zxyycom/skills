### Case VIDEO-OCR-COORDINATES-001: OCR 结果保持像素坐标与 ROI 契约

Tests:
- `test:17d74b15649dda60ecb7e16613eb82f82212beea47c37b2d0bcfc0c4ea1d2b9e`
- `test:353931c9d0c1be95131a79b07b63298fe78f5c50dc7f8c88d3ee4b593b326f52`
- `test:e43cff79666c24629f3679887473b41dcddd7829c8501d1352dbc5a11ee0df3f`

Tags:
- `video-understanding`

Contract:
- OCR boxes、region 和 transform 使用原 PNG 坐标，ROI 不能截断、舍入或越界；VideOCR 参数保持指定单 ROI 离线 CPU 行为。

Proves:
- 合法框和真实空结果保留，数组/坐标不一致与非法 ROI 被拒绝；原生参数不启用简繁转换、GPU 或 debug images。
