### Case VIDEO-ASR-TAIL-001: ASR 末端归一保持原始证据

Tests:
- `test:6f825a9ec2cd357d73707349b7211005e4e94dd786e50474cb1d404e52e7a01a`

Tags:
- `video-understanding`

Contract:
- 合法归一只改变登记终点，原始文件、ASR 来源和普通字幕时间保持不变。

Proves:
- 核对原始 JSON／SRT、登记内容和来源；警告在结果及关联查询中可见，未受影响的分页及普通／空 ASR 不产生归一警告，同请求复用不重跑识别。
