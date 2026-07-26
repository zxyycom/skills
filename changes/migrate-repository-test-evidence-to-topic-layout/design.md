# Design

本设计以机器可比的迁移清单拆分现有聚合主题文件，并让 topic 表、路径、统一索引和项目 owner 在同一 change 中切换到最终格式。

## Context

- 当前目录包含八个隐式主题文件：`change-plan`、`decision-records`、`index-runtime`、`investigation-report`、`shared-infrastructure`、`skill-updater`、`skill-validator` 和 `test-evidence`。
- 当前索引报告 90 个 case；该数字只描述本 change 建立时的基线。实施前必须重新扫描合法源并把实际数量写入迁移证据，不能把 90 写成长期契约。
- 当前活动决策 `organize-native-test-cases-by-responsibility-topic.md` 已标记 aligned，但它只描述直接子级主题 Markdown。若最终采用受控 topic 目录，该记录与事实都需要通过新的完整判断演进，不能直接改写历史掩盖差异。
- 前置 `organize-test-evidence-by-topic` 必须先完成并提供最终目录校验、metadata、topic 查询和升级契约。

## Goals / Non-Goals

目标：

- 让本仓库成为最终 topic 模型的完整消费者，而不是保留工具 fixture 与真实目录两套格式。
- 在拆分文件时保持 case ID 和证据字段逐项可比。
- 为每个 topic 写出稳定责任边界，并审阅跨工具或共享基础设施 case 的主要 owner。
- 让仓库说明、配置、检查和长期决策只指向一个当前格式。

非目标：

- 不借迁移重新设计测试、扩大测试覆盖或修改 case 粒度。
- 不因 topic 调整修改 case ID。
- 不长期保存“旧文件到新文件”的迁移表；迁移证据只属于本 change。
- 不要求 topic 数量永远等于当前候选数量。

## Decisions

1. 当前八个文件名只作为 topic 候选，不自动成为最终目录表。实施前逐项审阅 ID、description 和所属契约，特别检查 `shared-infrastructure` 是否过宽。
2. 迁移先从实施起点读取全部合法 case，生成包含源路径、case ID、标题、字段规范化摘要、候选 topic 和目标路径的临时清单；在写入前检查目标路径与 ID 碰撞。
3. 每个目标文件只保存一个 case。文件 slug 从 case 标题或稳定测试意图生成，不把序号、日期或临时任务名称当作语义路径。
4. case ID、Entry、Contract 和 Proves 是迁移前后内容对照的核心；只允许因独立查错而明确批准的语义修复，不把格式迁移与内容重写混在同一机械步骤。
5. topic 归属选择拥有被测试契约的主要责任。跨工具共享 fixture 或项目级基础设施只在确实没有更专门 owner 时进入共享 topic。
6. 先创建并校验 topic 表与目标文件，再移除中间聚合文件；所有解析后的绝对目标必须位于测试证据根目录。
7. 索引只在全部源文件和 topic 表通过严格目录检查后统一重建，不局部编辑或搬运旧索引 entry。
8. README、配置、导航和检查命令在同一 change 中切换，最终仓库不保留对 `docs/test-evidence/cases/*.md` 的当前格式说明。
9. 最终长期决策应保留“最小原生入口对应 case”并增加受控 topic 表、路径归属和 metadata；当前中间活动决策通过真实关系演进，待工具与仓库事实核对后再建立 aligned 基线。
10. 迁移完成后删除临时映射，保留 change plan、Git diff、严格检查和决策关系作为可回放证据。

## Risks / Trade-offs

- 一个聚合主题文件拆成大量文件会制造较大的 Git diff；需要内容哈希或规范化字段对照区分纯移动与语义变化。
- 当前 case、工具实现和测试代码曾作为同一基线落地。实施必须只修改本 change 拥有的目录、配置和项目说明，避免把后续测试审计误算为格式迁移。
- topic 边界审阅可能发现某些 case 应迁入不同责任；路径会变化但 ID 不变，直接 Markdown 链接仍需更新。
- 当前活动决策过早标记 aligned。演进时必须基于最终事实新建完整判断，不能仅编辑 alignment 或正文制造连续性。
- 项目检查若在迁移中途启用会阻断工作；实施顺序需要先构造完整候选目录，再一次性切换配置和检查。

## Open Questions

实施前需要确认最终 topic 表的 ID 与 description。当前八个名称仅作为候选，尤其需要决定 `shared-infrastructure` 是稳定责任还是应拆入更具体的项目工具链 topic；该问题阻塞实际文件归属，但不阻塞本计划的结构审阅。
