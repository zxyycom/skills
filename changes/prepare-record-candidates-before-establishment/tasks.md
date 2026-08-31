# Tasks

任务先固定候选与正式集合边界并接入共享诊断，再分别实现决策脚手架和调查批量发布，最后同步长期决策、生成物与验证证据。

## Readiness

- [ ] 0.1 核对两套 CLI 的现有参数、扫描、索引、关系事务、资源和恢复 owner，固定 `new` 的逐字段参数，以及 `creation`、`readiness`、`preflight` 输出与退出状态，不从正文或历史推断 metadata。
- [ ] 0.2 审阅 `separate-reviewable-candidates-from-established-decisions`、`model-investigation-evolution-as-direct-relations`、`maintain-report-level-investigation-index` 与 `stage-investigation-index-entries-by-report-id`，起草所需 successor Decision 并确认没有把 authoring candidate 写成正式生命周期。
- [ ] 0.3 核对 `make-maintenance-diagnostics-actionable` 的共享错误类型和 renderer 已可复用；未就绪时停止领域实现，不在新命令内复制权限、锁或事务结果分类。
- [ ] 0.4 盘点两套生成入口、公开声明、Schema、skill 版本、现有候选/同步测试和 Test Evidence case，形成精确改动与验证清单。
- [ ] 0.5 按 AI-Ready Docs 复核 proposal、design、tasks 和拟议命令帮助，确认 scaffold、activation-ready、authoring candidate、publish 与 sync-index 的指代和证明边界唯一。

## Implementation

- [ ] 1.1 更新两套 skill 入口、固定契约、人类说明和恢复说明，先固定目标命令、候选边界、事务预检非确认语义、选择性发布与全量同步职责。
- [ ] 1.2 为 Decision Records 增加 `new` 参数解析、规范序列化、目标身份/路径检查和 exclusive candidate scaffold 写入，并分别返回创建、正文 readiness 与 metadata 可确定的事务预检结果。
- [ ] 1.3 扩展决策扫描、校验、查询、展示、计数和 discard，使合法 scaffold 保持索引外且可编辑，只有 activation-ready candidate 能进入 `activate/evolve`。
- [ ] 1.4 让决策创建预检复用最终关系与生命周期准备服务，在不填造正文的前提下检查 alignment、关系形状、目标、预计最终图、索引影响和 Git `HEAD` 门禁；多后继闭包不足时报告 selection-incomplete，并删除任何 receipt、确认继承或自动重试路径。
- [ ] 1.5 为 Investigation Report 增加安全的 `_candidates/` 布局、`new` 参数解析与候选序列化，以及 `candidates`、`show-candidate` 查询，并让候选 readiness 与正式报告查询、索引 revision 分离。
- [ ] 1.6 实现 `publish <id...>` 的选择校验、空/既有正式基线加载、选中候选投影、最终关系闭包与资源校验，拒绝未选择候选和不可靠正式基线。
- [ ] 1.7 在调查集合 mutation lock 内实现候选移动与正式索引发布的漂移复核、提交点和恢复路径，确保未选择候选及其他工作区文件不被改写。
- [ ] 1.8 收敛 `sync-index`、默认 check、候选检查、正式 list/show/trace、set-relations、discard 与 stage-index 的职责和帮助文本，保留全量恢复与 index-only pending 边界。
- [ ] 1.9 同步两套公开结果类型、声明源、Schema、生成 CLI/source map/声明及 skill 版本，不手改生成产物绕过维护源码。
- [ ] 1.10 在行为实施并验证后建立候选完整性、调查 authoring workspace 和选择性 publish 的 successor Decision，归档被替代判断并同步决策索引。
- [ ] 1.11 为全部新增或修改的最小原生测试入口维护一入口一 case 的 Test Evidence Markdown，并同步统一测试证据索引。

## Verification

- [ ] 2.1 验证两个 `new` 对规范元数据、重复 tags/关系、非法 ID、已有候选/正式身份、符号链接和并发创建给出确定结果；输入/create 失败不产生目标，预检失败保留 scaffold 且不改变正式集合。
- [ ] 2.2 验证决策 scaffold 可发现、展示、编辑和 discard，但不进入索引/正式图或被建立；补全正文后同一 ID 成为 activation-ready。
- [ ] 2.3 验证决策预检不填造正文、能覆盖 metadata 可确定的关系与未记录前序，并对不完整多后继选择明确降级；真实 `activate/evolve` 重新读取 Git 和来源、再次暂停并要求本次显式参数，预检不留下 receipt。
- [ ] 2.4 验证调查候选不改变正式查询或索引新鲜度；单候选及归并/拆分批次 publish 只建立选中 ID，并拒绝缺失闭包、未选择目标和陈旧正式基线。
- [ ] 2.5 注入候选、正式来源、资源、索引和发布阶段漂移或写入失败，证明 publish 的零写入、完整回滚、恢复不完整和成功提交点结果准确。
- [ ] 2.6 验证 `sync-index` 能从正式根目录执行全量恢复且忽略合法候选内容，`stage-index` 仍只修改 Git pending 的索引范围，不承担 publish。
- [ ] 2.7 运行两套定向测试、生成物一致性检查、Decision Records/Investigation Report/Test Evidence 索引检查及 `bun run check`，并审计 diff 未吸收无关 Change。
