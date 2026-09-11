### Case DECISION-STAGE-NO-INFERENCE-001: Stage 不把无关的相同删除/新增绑定为改名

Tests:
- `test:c82be6e1a8e3eba1ba1849fec7789186b305dc8569569a9438cf59d0a2987bca`

Tags:
- `decision-records`

Contract:
- CLI 不从文本相同的删除/新增推断身份改名。

Proves:
- 暂存条目保持独立 D/A，而非 rename。
