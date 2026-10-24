### Case VIDEO-MEDIA-TIME-001: 媒体时钟与帧 PTS 保持一致

Tests:
- `test:09dcb0e31f97429dd93a3c787b6bc8e91dbf7cbc91d411aa6fda250e5dc9106c`
- `test:20c1ff316177af2febc7aff9173ae01b90e2d9391692e819d06412a9973e5f00`
- `test:644597d9e7598d69367e12906255020a224212c5ab54f672a715086879f208fd`
- `test:9220e6e1216ed369cdc4adc15d0da02189f16768930b93592872e178e7e7dc44`

Tags:
- `video-understanding`

Contract:
- 媒体时间必须可解释；原字幕时长不被臆造，帧的 requested 秒与实际 PTS/timeBase 分别保存。

Proves:
- 有效字幕排序时保留原字节语义；未知/非零媒体时钟和无效 PTS 映射被拒绝，进程结果与持久 schema 使用一致时间不变量。
