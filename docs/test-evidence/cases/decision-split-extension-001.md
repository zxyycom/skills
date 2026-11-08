### Case DECISION-SPLIT-EXTENSION-001: 选全后扩充拆分

Tests:
- `test:c4f68b6f910843204ea7ed757acb56c82e9282aac5777faf3e8824884a418f21`

Tags:
- `decision-records`

Contract:
- 扩充拆分须选择全部既有后继及新后继。

Proves:
- 先建立两后继拆分，再选全两既有后继及第三候选提交；索引保存三个后继、各自 alignment 和共同前序，最终图验证成功。
