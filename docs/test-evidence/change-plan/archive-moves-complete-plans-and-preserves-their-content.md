### Case CHANGE-PLAN-ARCHIVE-MOVE-001: 完整计划被原子归档
Entry:
- `tools/change-plan/tests/archive.test.ts > archive moves complete plans and preserves their content`
- `bun test --test-name-pattern="^archive moves complete plans and preserves their content$" ./tools/change-plan/tests/run.ts`
Contract:
- 完整 Plan 归档后移动到同一生命周期根的 archive 目录，并原样保留目录中的全部内容。
Proves:
- 成功结果报告目标目录且错误为空，源目录消失、目标目录存在。
- 随 Plan 保存的 `evidence.md` 在归档目录中保持原始字节。
- 底层移动失败时保留活动源目录，并清理本次新建且仍可确认身份的空 archive 容器。
