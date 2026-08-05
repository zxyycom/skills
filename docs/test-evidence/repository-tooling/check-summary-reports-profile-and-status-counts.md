### Case CHECK-SUMMARY-FORMAT-001: 检查汇总报告档位与状态计数
Entry:
- `scripts/check.test.ts > check summary reports profile and status counts`
- `bun test --test-name-pattern="^check summary reports profile and status counts$" ./scripts/check.test.ts`
Contract:
- 最终汇总必须显示整体状态、执行档位、检查总数、各状态计数和总耗时。
Proves:
- 汇总根据失败项计算整体失败状态。
- passed、skipped、failed 的数量和总数均按报告集合计算。
