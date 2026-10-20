### Case DECISION-STAGE-NO-INFERENCE-001: Stage 不把无关的相同删除/新增绑定为改名

Tests:
- `test:c82be6e1a8e3eba1ba1849fec7789186b305dc8569569a9438cf59d0a2987bca`

Tags:
- `decision-records`

Contract:
- Stage 不从文本相同的删除/新增推断身份改名。

Proves:
- 纯 target 构造保留 old 的删除标记与 new 的新增来源，最终来源仅含 new；不以 Git diff 格式证明分类。
