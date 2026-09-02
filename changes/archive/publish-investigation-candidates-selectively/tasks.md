# Tasks

任务先固定候选文件、资源 owner、命令退出和正式基线，再实现 authoring 查询、只读 preflight、选择性 publish 与候选清理，最后同步长期判断、分发产物和证据。

## Readiness

- [x] 0.1 核对当前 CLI 参数、根目录发现、报告/资源解析、完整关系验证、state-index、集合锁、sync/set-relations/discard/stage-index 和恢复 owner，记录候选与 publish 的精确复用点和 blast radius。
- [x] 0.2 审阅 `model-investigation-evolution-as-direct-relations`、`maintain-report-level-investigation-index`、`stage-investigation-index-entries-by-report-id` 和当前固定契约，起草 authoring workspace 与选择性 publish 的 successor Decisions。
- [x] 0.3 将已归档维护诊断 Change 的实际 InvestigationDiagnostic、renderer、warning、mutation outcome 和恢复文本映射到 `new`、`publish` 与 `discard-candidate`；确认只读结果不附会 mutation 字段。
- [x] 0.4 固定 `_candidate.<investigation-id>`、authoring resource owner、首次/既有正式基线、`help new`、`publish [--preflight]` 与 `discard-candidate` 的逐字段参数、stdout/stderr、退出码和确认语义。
- [x] 0.5 盘点维护源码、公开类型、Schema、生成入口、skill 版本、当前 sync/relations/resources/discard/stage 测试和 Test Evidence case，形成精确修改与验证清单。
- [x] 0.6 按 AI-Ready Docs 复核 proposal、design、tasks 和拟议帮助，确认 candidate、formal report、body/resource readiness、preflight、publish、sync-index 与 lifecycle 的指代唯一。

## Implementation

- [x] 1.1 更新 Investigation Report skill、固定契约、恢复说明和人类介绍，先固定保留候选文件、资源位置、正常 publish、全量 sync 和非 lifecycle 边界。
- [x] 1.2 扩展 report path/source discovery 与公开类型，安全发现 `_candidate.<id>`、拒绝未知保留文件和候选/正式身份冲突，并保持正式 source revision/index 忽略候选。
- [x] 1.3 扩展 Markdown 和 resource validation，为候选返回 `scaffoldValid`、`bodyReady`、`resourceReady`，识别候选 owner 与共享资源而不改变正式 owner/index 语义。
- [x] 1.4 实现 `new` 参数解析和规范序列化；在集合锁内重读候选/正式身份，以完整临时内容原子且不覆盖地创建 candidate scaffold。
- [x] 1.5 为 `new` 分别渲染 creation、body/resource readiness 和单候选辅助 preflight；创建成功后退出 `0`，warning/attention/unavailable 不要求重跑 `new`。
- [x] 1.6 实现 `candidates` 与 `show-candidate`，并收敛默认/scoped check、正式 list/show/trace 对候选成员安全、诊断和忽略边界。
- [x] 1.7 实现 publish preparation：加载首次或当前正式基线、显式候选选择、完整 report view、最终关系闭包、资源 snapshot、Git warning 和规范最终索引，拒绝未选择候选与正式来源漂移。
- [x] 1.8 实现 `publish --preflight`，复用完整 preparation、按门禁退出并保持候选、正式报告、资源、索引和 pending 零写入，不保存 receipt。
- [x] 1.9 在集合 mutation lock 内实现普通 publish 的重读、漂移复核、不覆盖候选改名、索引提交点、完整回滚与恢复不完整结果，确保未选择候选和资源不被改写。
- [x] 1.10 实现 `discard-candidate` 的单 ID、owner 资源选择、跨正式/候选引用、Git recorded confirmation、精确 tombstone 和 cleanup 恢复，不读取或更新正式索引。
- [x] 1.11 收敛 `sync-index`、正式 `set-relations`、`discard`、默认 check 和 `stage-index` 的候选安全/忽略职责与帮助文本，保留全量接纳和 index-only pending 边界。
- [x] 1.12 同步 Investigation Report CLI 帮助、公开结果类型、Schema、生成 CLI/source map 和独立 skill 版本，不手改生成产物绕过源码 owner。
- [x] 1.13 在行为实施并验证后建立 authoring workspace 与选择性 publish 的 successor Decisions，归档被替代判断并同步决策索引。
- [x] 1.14 为全部新增或修改的最小原生测试入口维护一入口一 case 的 Test Evidence Markdown，并同步统一测试证据索引。

## Verification

- [x] 2.1 验证 `new` 对规范 metadata、重复 tags/关系、非法 formedAt/ID、已有候选/正式身份、未知保留文件、符号链接、锁失败和并发创建给出确定结果；输入或创建失败不产生目标。
- [x] 2.2 注入创建后的 body/resource incomplete、关系 warning 与 Git/index preflight unavailable，证明候选保留、命令退出 `0`、输出分区正确且恢复文本指向查询或 `publish --preflight`。
- [x] 2.3 验证正式 list/show/trace、索引 state/source revision 和 stage-index 忽略候选；默认 check 只让成员安全/身份冲突阻断正式集合，候选查询准确报告 scaffold/body/resource readiness。
- [x] 2.4 验证候选自有资源与共享正式资源都使用不变的 `./_resources/...` 链接；缺失、ignored、符号链接、非法 owner、跨候选共享和资源成员/身份漂移按边界处理，单纯字节变化不使索引或 publish 失效。
- [x] 2.5 验证 `publish --preflight` 对首次空集合、单候选、归并和拆分批次生成完整最终图/index 且零写入，并拒绝未选择 target、缺失闭包、损坏/陈旧正式基线和手工正式来源漂移。
- [x] 2.6 验证普通 publish 只建立选中 ID；注入候选、正式来源、资源、索引和发布阶段漂移或写入失败，证明 no-change、完整回滚、恢复不完整和成功提交点准确，未选择候选保持逐字节不变。
- [x] 2.7 验证 `discard-candidate` 的普通删除、owner 资源显式删除、共享引用阻断、Git recorded confirmation、cleanup pending 和恢复失败；正式 `discard` 不接受候选。
- [x] 2.8 验证 `sync-index` 从正式根目录执行全量恢复/接纳且忽略合法候选，手工正式来源不会被普通 publish 吸收，`stage-index` 仍只修改 Git pending 的索引范围。
- [x] 2.9 运行 Investigation Report 定向测试、类型检查、生成物一致性、Decision/Investigation/Test Evidence 索引检查及 `bun run check`，并审计 diff 只包含本 Change 可归因范围。
