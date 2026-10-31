### Case VIDEO-BOUNDED-PROJECTION-001: 读取投影有界且保留依据

Tests:
- `test:9e2e484d5dcd5480ea1777cebc2243190da51e86d3483d4410022ba35fd3f81a`
- `test:bf47de9c89432da15cc88014de3418c8b1b5d6512aa382c759f19a42c1a0d57c`

Tags:
- `video-understanding`

Contract:
- 普通读取使用有界确定性投影，完整材料与校正细节通过 JSON、分页或明确 ID 获取。

Proves:
- 紧凑文本保留 provenance 和定位；大目录的 offset、remaining、related 上限及文本/JSON 投影稳定，不混入无关原文。
