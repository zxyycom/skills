### Case VIDEO-ASR-TAIL-001: ASR 末端容差保持原始证据

Tests:
- `test:1c48c71cddf6ae86aeb8a32d8fc3229db2c8396866379fbf4f0927375bc378c9`
- `test:2b257cb4866acb45323618f315a6f4491fa5b0625c45f071800a99987d044833`
- `test:4c13a157ca957b72d361091c25f3adcc242fe83dc21af8b3ffa29e7ba71b3771`
- `test:686da4a31c86ccfa8933779cc34fc8a3bd380c5dfa2fc068d2916df559065736`

Tags:
- `video-understanding`

Contract:
- 只有 ASR 单个末尾重叠 cue 可在 25 ms 内归一；其他来源不借用此容差，原始输出与来源必须保留。

Proves:
- 允许的末端被归一并返回可审计 warnings；超界、多个重叠或非 ASR 输入被拒绝，历史成功结果与原始字节不受破坏。
