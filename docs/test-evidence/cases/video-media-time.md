### Case VIDEO-MEDIA-TIME-001: 媒体时钟与帧 PTS 保持一致

Tests:
- `test:3ce0d59d3fdde0903922691d93f593a8e7ef48e8a659af83202f38dc8b7c2f1d`
- `test:4c5c4570187908dc177f1bc4d59e36779176b7b9a223fd375a580a5f31382de4`
- `test:4ecf951f0403e9f010cbfa0169cd02fccfba94168486f4b798e8636958312d9b`
- `test:7d65008965b81c802ddd433dc22471ecd4337f7ec443dc822c3cbd973a16ee39`

Tags:
- `video-understanding`

Contract:
- 媒体时间必须可解释；原字幕时长不被臆造，帧的 requested 秒与实际 PTS/timeBase 分别保存。

Proves:
- 有效字幕排序时保留原字节语义；未知/非零媒体时钟和无效 PTS 映射被拒绝，进程结果与持久 schema 使用一致时间不变量。
