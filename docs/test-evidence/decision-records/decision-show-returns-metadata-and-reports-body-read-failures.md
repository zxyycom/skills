### Case DECISION-SHOW-OUTPUT-001: 决策展示返回元数据并报告正文读取失败
Entry:
- `tools/decision-records/tests/queries.test.ts > decision show returns metadata and reports body read failures`
- `bun test --test-name-pattern="^decision show returns metadata and reports body read failures$" ./tools/decision-records/tests/run.ts`
Contract:
- Show CLI 必须从当前决策源返回领域与生命周期元数据，并在正文读取失败时停止输出部分结果。
Proves:
- 成功结果包含路径、领域说明、状态、对齐、建立时间和正文标题。
- 模拟正文读取失败时退出码为 1、stdout 为空且 stderr 定位目标决策。
