### Case CHANGE-PLAN-CATALOG-LIFECYCLE-001: 目录按生命周期列出计划
Entry:
- `tools/change-plan/tests/catalog.test.ts > catalog lists active, archived, and all change plans`
- `bun test --test-name-pattern="^catalog lists active, archived, and all change plans$" ./tools/change-plan/tests/run.ts`
Contract:
- Change catalog 支持 active、archived 与 all 生命周期筛选，并在每个条目中公开适用的阶段与 Git 距离证据。
Proves:
- 每种筛选只返回对应生命周期且排序稳定的计划；活动 Plan 返回距离证据，归档历史不解释 metadata 且距离为空。
