# Proposal

建立可独立使用的卡片驱动小说创作 skill；本计划保存该 Change 的实施与验证上下文。

## Why

作者需要以详情与递归总结组织原创和续写，让规划修改、按卡写作与正文对照共享同一套故事事实，并能核对实际引用和阅读范围。

## Outcome

交付 novel-cards skill、自包含本地卡片 CLI 和可浏览的临时小说项目示例；卡片维护与正文反推对照都有可执行流程，引用查询能拒绝无效或陈旧身份。

## Scope

### Intended Change

1. 用详情卡与任意递归总结卡组织剧情、人物、设定与历史；组织标签不固定层级，children 与 sources 分开。
2. 卡片先改、最高受影响层向下传播；区分发生状态、展开完整度、故事时间、叙述位置以及当前与参考区。
3. 提供本地 `check`、`sync-index`、`show` 与有界 `expand`；Markdown 声明稳定 ID，索引从来源派生。
4. 用流程与报告模板实现正文提取、分阶段对照与证据回查；本 Change 交付本地流程。

### Resulting Impacts

1. 在 `tools/`、`scripts/build/` 与 `skills/` 之间保持源码/生成边界，接入仓库验证、updater 和入口。
2. 新增真实原生测试入口与证据 Case，覆盖身份、引用、循环、陈旧索引及参考隔离。
3. 临时展示项目保留供作者查看，与长期分发内容分开；稿件保留本地。Plan 结项删除须另获授权。

## Success Criteria

1. 有效递归、待展开未来、依据交叉引用、人物关系与时间可表达且本地 CLI 可用。
2. 重复 ID、失效引用、children 循环、陈旧索引及错误身份/路径被拒绝，不猜测相似卡。
3. 行为文档明确上层语义复核、参考显式读取、反推提取与对照分离以及作者修订权。
4. 结构、生成一致性、目标测试与仓库检查真实运行，机械证据与文学质量分别交付。

## Affected Owners

- `skills/novel-cards/`：行为入口、卡片契约、报告模板及分发 CLI。
- `tools/novel-cards/` 与 `scripts/build/novel-cards.ts`：运行时源码、测试与构建适配。
- `README.md`、`AGENTS.md`、`docs/skills/novel-cards.md`、`docs/tooling.md`：必要入口。
- `package.json`、项目配置与 Gate catalog：命令、生成及测试接入。
- `docs/test-evidence/` 与 `docs/decisions/`：测试证据和达到门槛的长期选择。
