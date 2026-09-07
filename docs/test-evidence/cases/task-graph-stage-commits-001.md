### Case TASK-GRAPH-STAGE-COMMITS-001: 并发 task 变化可形成独立提交

Tests:
- `test:6e4ab8e26b46d3d7ea525432d87276a586e159efca18bf6874e398723c7193c8`

Tags:
- `task-graph`

Contract:
- 同一目标索引中的多个 task 变化可以依次按 ID 构造 pending 并分别提交，分段命令不改写完整工作区候选。

Proves:
- 第一个真实 Git commit 只包含第一个 task 的候选条目，第二个 commit 再加入第二个 task。
- 两次暂存之间工作区始终保留完整候选；第二次提交后 HEAD 等于候选且工作区无剩余差异。
