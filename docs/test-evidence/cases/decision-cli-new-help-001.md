### Case DECISION-CLI-NEW-HELP-001: New 帮助固定显式 scaffold 输入

Tests:
- `test:420d14768d535213189f03a210a58c05df48bf71092cebc6c8fddb6a59e09ad4`

Tags:
- `decision-records`

Contract:
- `new` 帮助应公开关系和摘要选项，并区分 scaffold 与正文就绪后发布。

Proves:
- 真实原生 CLI 的 `help new` 成功且包含 relation、relation-summary、scaffold、body 与 publication 文本。
- 本节点检查这些术语，不单独断言全部 metadata 参数、选项互斥或具体说明语义。
