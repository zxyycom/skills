### Case INVESTIGATION-COMMITTED-WRITER-REJECTION-001: 调查关系事务保留writer拒绝后的已知提交

Tests:
- `test:6dc5d6daafc9bf0e1f46e76d11a2d3740bd4124a2c387e1e973ee776df325949`

Tags:
- `investigation-report`

Contract:
- 正式索引实际发布后writer拒绝不能触发旧状态回滚或成功review。

Proves:
- SDK错误结果保留changed与partial-or-unknown，两份新正文／索引关系保持一致，relationReview省略。
