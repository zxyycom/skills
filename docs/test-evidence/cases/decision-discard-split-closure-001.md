### Case DECISION-DISCARD-SPLIT-CLOSURE-001: Discard 拒绝会打开拆分闭包的后继

Tests:
- `test:75520649c5e5bad21ae20a12c449f29dd3e9c67216aa510222165ccfa6281fea`

Tags:
- `decision-records`

Contract:
- 已建立拆分关系必须始终保有至少两个直接拆分后继；direct discard 不能删除其中一个后继而留下开放拆分。

Proves:
- 对闭合拆分的一个后继执行 discard 会在写入前返回最终关系图一致性诊断。
- 被选后继的 Markdown 和正式索引均保持不变。
