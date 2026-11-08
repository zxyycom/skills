### Case DECISION-SOURCE-DUPLICATE-MEMBERSHIP-001: 无效记录仍参与声明身份重复检测

Tests:
- `test:2e9db4e3324097faff1e6a2d5a58daa56abdb725f47ba8ddeebcd0f539e2819a`

Tags:
- `decision-records`

Contract:
- 可提取声明 ID 的无效 candidate 仍参与身份重复检查，不能与正式来源共用 ID。

Proves:
- 真实 CLI check 对无效 candidate 与正式来源同 ID 报告 duplicate-id；full sync 同样失败并报告两项来源错误，两入口均保留索引及来源字节。
