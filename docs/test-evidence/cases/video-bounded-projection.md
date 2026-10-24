### Case VIDEO-BOUNDED-PROJECTION-001: 读取投影有界且保留依据

Tests:
- `test:26a3bf0055725eeb8452cbc4a83a9ada5ca9b28b1be6ce2cdc46e432dc73ab82`
- `test:9d187f294674e654addc6b9c0cb4564584b1be456443bae3ef70e47c855e4cf9`

Tags:
- `video-understanding`

Contract:
- 普通读取使用有界确定性投影，完整材料与校正细节通过 JSON、分页或明确 ID 获取。

Proves:
- 紧凑文本保留 provenance 和定位；大目录的 offset、remaining、related 上限及文本/JSON 投影稳定，不混入无关原文。
