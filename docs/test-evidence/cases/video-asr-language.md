### Case VIDEO-ASR-LANGUAGE-001: 音轨与识别语言来源不混淆

Tests:
- `test:32d6b765dfaf48d8ace54522f75450f3da68704c0825e60e9057b1aec3e318ee`
- `test:85be66b514b956d2b7e0ffa02d7c007ef78121353dab568ce35e2ffdd64f44b7`
- `test:d9cb58d0412d0e2b0c6a74c90c4542356c5abd7b67a803f90ef93a662835dfb1`

Tags:
- `video-understanding`

Contract:
- 识别结果语言来自实际 recognizer；请求语言、历史未知来源和无音轨输入不能被提升为识别事实。

Proves:
- 无音轨时不调用 ASR；自动与显式语言请求保留请求模式，旧无模型空结果不自动复用且保持 unknown 语义。
