### Case VIDEO-ASR-LANGUAGE-001: 音轨与识别语言来源不混淆

Tests:
- `test:1c87689e68ed536e95d7056c85a09eea306a66e507dd19fd6421c62dbd7c9d80`
- `test:582ecc7e40b7aa783835c60e96c031a3b86b9653d48c52fbbf254d791a9abe3d`
- `test:a292f839829309d5003a7911e31ce0acab88a3e535742d1f70b3926eb993943d`

Tags:
- `video-understanding`

Contract:
- 识别结果语言来自实际 recognizer；请求语言、历史未知来源和无音轨输入不能被提升为识别事实。

Proves:
- 无音轨时不调用 ASR；自动与显式语言请求保留请求模式，旧无模型空结果不自动复用且保持 unknown 语义。
