### Case DECISION-EVOLVE-GROUPED-RECOVERY-001: 分组 Evolve 在发布后 writer 拒绝时保留提交且不输出成功 review

Tests:
- `test:0a65d98bc83c532644a4270f7b73fa7dbe5c7db03d71692c04fd85f2005fb218`

Tags:
- `decision-records`

Contract:
- 正式索引实际发布是提交点；分组 Evolve 的 writer 发布后拒绝不能回滚已提交后继或把 relationReview 声明为成功 committed。

Proves:
- 索引 rename 实际完成后注入 EIO，命令非零、stdout 为空且 outcome 为 partial-or-unknown；两个后继 Markdown 与新 index 均保留各自关系摘要。
