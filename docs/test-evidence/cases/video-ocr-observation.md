### Case VIDEO-OCR-OBSERVATION-001: OCR 保持原始观察身份

Tests:
- `test:ca11fa1661af301dd69bcfb746ed1d77a3c713d2ccc10a30d14aac0506e76d18`
- `test:d8e9c8b2c5df976fd357b9eed32586c240c1c4cbb202999d4bb59e648a957993`

Tags:
- `video-understanding`

Contract:
- 帧 OCR 是带原图与时间依据的机器观察，不是 authored 描述或自动采用的叙事。

Proves:
- 硬字幕识别接收原视频和精确 ROI，帧 OCR 分别接收两张有效且不同的 PNG；原生节点外层独立核对观察与帧身份、图像 hash、PTS/timeBase、文字、boxes/scores 和覆盖，复用不重复识别，fresh 空观察仍追加登记。
- frame-only authored selection 明确区分观察与描述。
