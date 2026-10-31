### Case VIDEO-OCR-OBSERVATION-001: OCR 保持原始观察身份

Tests:
- `test:ca11fa1661af301dd69bcfb746ed1d77a3c713d2ccc10a30d14aac0506e76d18`
- `test:d8e9c8b2c5df976fd357b9eed32586c240c1c4cbb202999d4bb59e648a957993`

Tags:
- `video-understanding`

Contract:
- 帧 OCR 是带原图与时间依据的机器观察，不是 authored 描述或自动采用的叙事。

Proves:
- 硬字幕与帧 OCR 保留原像素和 PTS；空观察仍登记，复用不重复识别，frame-only authored selection 明确区分观察与描述。
