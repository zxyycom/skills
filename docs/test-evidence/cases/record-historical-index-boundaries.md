### Case RECORD-HISTORY-INDEX-001: 固定历史来源与缺索引边界

Tests:
- `test:8e9f09c73aaa7c1d5316cc2b8583a841731b32c11cb76be65edfddeb31a877cf`
- `test:b62f2170eeb9d5374ea5d18f3677032e7a429cfb44be0933d4fb109d619d8afb`

Tags:
- `decision-records`
- `git-integration`
- `investigation-report`

Contract:
- 历史 Git 来源使用固定 commit 定位；有历史成员但缺索引时不能静默作为空集合。

Proves:
- 真实 Git 固定 commit 可读指定路径并区分缺失；DR 及 IR 正式历史成员缺索引时暂存拒绝且 pending 保持。
