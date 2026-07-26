# Tasks

任务按前置目录、历史清单、逐组原生节点审计、case 对照和完整验证推进，完成出口是当前历史账本经复核后符合自然 runner 粒度。

## Readiness

- [ ] 0.1 确认 topic 工具和本仓库目录迁移两个前置 changes 已完成，最终 topic 表、单 case 路径和索引均处于当前状态。
- [ ] 0.2 对照引入原生测试账本的基线提交与当前工作区，标出后续用户改动、本 change 候选改动和无关内容，禁止整体覆盖。
- [ ] 0.3 列出稳定 `test:*` 命令、run 容器、测试模块、当前 runner 节点、现有 case 和工程校验排除项，形成实施起点历史审计清单。
- [ ] 0.4 对每个候选测试意图区分原生节点、聚合容器和内部环节，并确认待拆节点都拥有独立名称、最终结果和单一测试意图。
- [ ] 0.5 核对三个 artifact 不修改通用 topic 工具、不增加源码采集，并确认没有阻塞实施的开放问题。

## Implementation

- [ ] 1.1 按测试组审计当前框架选择、并发模型、fixture 生命周期和精确节点命名；只有现有选择不满足最小维护面时才调整框架。
- [ ] 1.2 逐组复核 change-plan、decision-records、index-runtime、investigation-report、test-evidence、skill-updater、skill-validator 和共享项目测试，保持正确原生节点并修复仍聚合或过度拆分的意图。
- [ ] 1.3 审计并收敛各 `run.ts` 和 package `test:*` 命令，使其只启动或导入真实 runner，并让失败节点名称和退出码稳定可见。
- [ ] 1.4 对依赖全局 process 状态、平台模拟、临时目录或生成文件的测试补齐必要隔离与清理，避免框架并发改变既有语义。
- [ ] 1.5 为每个保留原生节点在对应 topic 中创建或更新唯一 case，确保 Entry 定位同一节点，Contract 与 Proves 保持可独立理解。
- [ ] 1.6 删除或修正把文件、tool、skill、suite、run 脚本或 CI job 当作入口的聚合 case，并避免为 helper、fixture、断言或步骤创建 case。
- [ ] 1.7 完成历史审计清单到最终 runner 节点与 case 的逐项对照，解释所有排除、合并、拆分、删除或实施期间新增项。
- [ ] 1.8 重建测试证据索引，并让项目 check 按稳定顺序运行各测试命令、生成检查和目录严格检查。

## Verification

- [ ] 2.1 对每个测试组运行 runner，保存节点级通过/失败名称和数量，确认容器没有被报告为额外 case。
- [ ] 2.2 对依赖共享状态的代表性测试执行重复和隔离运行，确认无并发污染、临时资源泄漏或顺序依赖。
- [ ] 2.3 查询全部 case 并与历史审计清单对照，证明每个保留原生节点恰好一个 case、每个 case 恰好定位一个节点。
- [ ] 2.4 人工抽查每个 topic 的 Entry、Contract 和 Proves，确认没有聚合模块 case、内部环节 case或工程校验 case。
- [ ] 2.5 运行 test-evidence 严格目录检查、所有目标测试、`bun run typecheck` 和 `bun run check --strict`，记录实际结果与任何环境限制。
- [ ] 2.6 用至少一个非 `node:test` 或无需改造的既有框架测试组验证“框架中立”边界，确认 skill 与账本不依赖特定注册 API。
