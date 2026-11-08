### Case DECISION-STAGE-OVERLAY-001: Stage 应用选择的新增、修改与删除

Tests:
- `test:01b3816ffcec8cbbf786bd24060a09f08bd40823da097a002acf3647b3f89563`

Tags:
- `decision-records`

Contract:
- all scope 将所选新增、修改、删除和相应索引共同合成 pending，未选 pending 保持。

Proves:
- 真实 Git 单次选择新增、修改、删除三个 ID；pending 新增及修改正文等于工作区字节，删除路径退出；索引两个成员的标题及新记录状态、alignment、空 relations 符合独立预期，无关 pending 保持。
