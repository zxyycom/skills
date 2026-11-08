### Case DECISION-STAGE-DELETION-001: 选择旧 ID 表达删除而非改名

Tests:
- `test:64cb075bde1bd43f9cd98895478d08477bfbb37eda788e461cb698051b786154`

Tags:
- `decision-records`

Contract:
- 单选 old ID 表达已同步删除，工具不从未选 replacement 推断身份改名。

Proves:
- 真实 Git 中，原生 stage 删除选中 old 的 pending 正文与索引投影；未选 replacement 不进入 pending、工作区字节保持，无关 pending 仍保留。
