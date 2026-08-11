### Case CHECK-SUMMARY-FORMAT-001: 检查汇总报告档位与状态计数
Entry:
- `scripts/check.test.ts > check summary reports profile and status counts`
- `bun test --test-name-pattern="^check summary reports profile and status counts$" ./scripts/check.test.ts`
Contract:
- 最终汇总必须渲染同一次检查工作流已经形成的整体机器状态，并显示执行档位、检查总数、各状态计数和总耗时。
Proves:
- 打包失败形成的工作流失败状态被摘要原样渲染，不从报告计数重复派生。
- passed、skipped、failed 的数量和总数均按报告集合计算。
