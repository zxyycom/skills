### Case INVESTIGATION-COMMITTED-WRITER-REJECTION-001: 调查关系事务保留writer拒绝后的已知提交

Tests:
- `test:80eb98f7a35ae8ce792e8723915dcc89bf473ed5233084d39d204778fccf233f`

Tags:
- `investigation-report`

Contract:
- 正式索引实际发布后writer拒绝不能触发旧状态回滚或成功review。

Proves:
- SDK错误结果保留changed与partial-or-unknown，两份新正文／索引关系保持一致，relationReview省略。
