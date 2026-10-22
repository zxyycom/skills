### Case DECISION-CANDIDATE-NEW-001: New 创建规范未完成 scaffold 且不建立记录

Tests:
- `test:81b6e77dfff3b8da3549e9f85e89e552557c9e075c9ee6658a7a6de3684dde55`

Tags:
- `decision-records`

Contract:
- new 只验证自身输入、身份、安全路径和不覆盖条件，创建合法但未完成的候选；不默认运行发布级辅助预检，无关正文问题由正式门禁与显式检查发现。

Proves:
- 创建输出只表达 scaffold/body readiness，候选未进入发布索引；重复身份、锁冲突和非法路径仍拒绝且不覆盖；无关坏正文不阻断新草稿。
