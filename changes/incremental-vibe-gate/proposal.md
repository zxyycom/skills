# Proposal

本 Change 将日常 Vibe Gate 从固定重跑全部 base Checks 调整为以一次工作区快照、显式影响契约和可验证通过证据驱动的增量门禁。

## Why

当前无 release tag 的 Gate 仍固定执行七项原生检查、二十五个 package command Checks 和三项 Change Plan 语义测试；同一工作区的文件枚举、读取、解析及测试 fixture Git 操作大量重复，现有缓存只有调度历史与 Markdown 解析事实，热运行仍约 22 秒，不能满足普通增量运行低于 10 秒、较重增量运行低于 15 秒的维护反馈目标。

## Outcome

日常 Gate 只形成一次当前工作区内容身份，能够证明某个 Check 的完整有效输入与其最近一次通过证据相同时不启动该 Check；任何直接、传递、共享、配置、工具链或未分类影响都会使对应 Check 保守启动，release 仍形成完整交付门禁。

## Scope

### Intended Change

- 在项目 Gate owner 内建立一次性文件快照、文件到影响标签的派生规则、标签依赖闭包、Check 输入声明和通过证据存储。
- 以 Check 的有效输入指纹而不是“所属目录没有改动”定义无关；没有可验证通过证据、输入未知或分类缺失时执行而不是跳过。
- 让 Vibe 原生 flag/effective aggregation 继续承担实际 Check 选择与调度，项目层只形成本次要激活的稳定 Check IDs 和证据。
- 继续减少 test-evidence catalog 内重复来源指纹、AST 扫描、闭包和注册工作，并为完整 snapshot fact 建立内容寻址缓存。

### Resulting Impacts

- 日常 Gate 的机器结果需要区分本次执行、因有效输入未变而复用通过证据，以及 release-only 未启用。
- 新增或移动文件、跨 owner 依赖、共享配置和工具链变化必须进入影响契约；未分类输入保守扩散到全部 Checks。
- 缓存损坏、缺失或工作区漂移不得形成通过证据；环境或外部状态型 Check 需要声明为始终执行或覆盖其完整状态身份。
- 当前 Gate 选择与缓存决策、项目工具链说明、长期项目决策和测试证据需要同步。

## Success Criteria

- 相同工作区的第二次日常 Gate 不启动已有精确通过证据覆盖的昂贵 Check，并明确报告复用情况。
- 文件只在完成标签传播后的有效输入与某个 Check 相交时使其启动；新增未分类文件、共享边界、配置或工具链变化保守启动所有可能受影响 Checks。
- 直接和传递影响、首次运行、失败后重试、缓存损坏、内容回退、并发工作区漂移及 release 全量行为都有自动化证据。
- 代表性热运行显著低于当前约 22 秒，并以普通增量低于 10 秒、较重增量低于 15 秒为验收目标；不能达到时保留分项证据而不以调度下界解释为完成。
- `bun run check` 与受影响的类型、lint、测试证据和项目文档验证通过。

## Affected Owners

- `scripts/lib/vibe-gate.ts`、`scripts/lib/vibe-gate/` 与 `scripts/vibe-check.ts` 的项目 Gate owner。
- `docs/tooling.md` 与项目级 Vibe Gate 决策记录。
- `scripts/test-evidence/` 的项目实体 snapshot producer/check owner。
- `docs/test-evidence/cases/` 与派生索引。
