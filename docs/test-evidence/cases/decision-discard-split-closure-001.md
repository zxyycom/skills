### Case DECISION-DISCARD-SPLIT-CLOSURE-001: Discard 拒绝会打开拆分闭包的后继

Tests:
- `test:482b8f8e1da000a8f40d9c67b76b56b697b21fb29bfaffa0d4b7ac716f727f66`

Tags:
- `decision-records`

Contract:
- 已建立拆分关系必须始终保有至少两个直接拆分后继；direct discard 不能删除其中一个后继而留下开放拆分。

Proves:
- 对闭合拆分的一个后继执行 discard 会在写入前返回最终关系图一致性诊断。
- 被选后继的 Markdown 和正式索引均保持不变。
