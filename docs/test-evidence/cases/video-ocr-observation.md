### Case VIDEO-OCR-OBSERVATION-001: OCR 保持原始观察身份

Tests:
- `test:23810b16736ac552930fd1d80bf2649e1eaa3c139c7ce740da418ada19cfe770`
- `test:9fdb20b584c75685ae0abcaf009efc8f43b4ac652ecbf763407df4a29af33632`

Tags:
- `video-understanding`

Contract:
- 帧 OCR 是带原图与时间依据的机器观察，不是 authored 描述或自动采用的叙事。

Proves:
- 硬字幕与帧 OCR 保留原像素和 PTS；空观察仍登记，复用不重复识别，frame-only authored selection 明确区分观察与描述。
