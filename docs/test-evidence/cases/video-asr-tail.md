### Case VIDEO-ASR-TAIL-001: ASR 末端归一保持原始证据

Tests:
- `test:4c13a157ca957b72d361091c25f3adcc242fe83dc21af8b3ffa29e7ba71b3771`
- `test:686da4a31c86ccfa8933779cc34fc8a3bd380c5dfa2fc068d2916df559065736`

Tags:
- `video-understanding`

Contract:
- 合法归一只改变登记终点，原始文件、ASR 来源和普通字幕时间保持不变。

Proves:
- 核对原始 JSON／SRT、登记内容和来源；警告在结果及关联查询中可见，未受影响的分页及普通／空 ASR 不产生归一警告，同请求复用不重跑识别。
