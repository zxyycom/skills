### Case DECISION-STAGE-BOOTSTRAP-001: Stage 构建第一份决策集合投影

Tests:
- `test:d49365a9ae5e022fb25b55f4da1869d35e9846cb8ee8b44beb5d2be537b061f6`

Tags:
- `decision-records`

Contract:
- 没有基线决策来源时，领域 target 可选择首个记录并构建首份派生索引投影。

Proves:
- 空 baseline 的 target 只含所选首个 Markdown 路径，生产索引投影只有该 ID 且 sourcePath 正确。
