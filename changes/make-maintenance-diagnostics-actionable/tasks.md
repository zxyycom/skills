# Tasks

任务先建立错误清单和共享事实模型，再向 index-runtime 与两套领域映射，最后用故障注入证明 cause、mutation scope/outcome 和恢复建议准确。

## Readiness

- [ ] 0.1 盘点共享版本控制、index-runtime、Decision Records 与 Investigation Report 的全部用户可见失败和旧 `VersionControlError.code` 消费者，记录当前 cause、target、mutation 阶段及提示缺口。
- [ ] 0.2 固定相互独立的 operation event code、cause category、operation、target、detail 和 recovery schema，逐类映射权限、锁、仓库、revision、Git command、pending 与恢复失败，拒绝没有强信号的过度分类。
- [ ] 0.3 核对每个工作树、索引和 pending 事务的真实提交点与恢复证据，固定 mutation scope，并确定 scope/outcome 只能由哪个事务 owner 设置。
- [ ] 0.4 与 `prepare-record-candidates-before-establishment` 对齐实施顺序和复用入口，确保新命令不先形成临时字符串协议。
- [ ] 0.5 按 AI-Ready Docs 审阅诊断契约、恢复动作和测试矩阵，确认操作者能从局部输出恢复失败对象、原因、影响与下一步。

## Implementation

- [ ] 1.1 扩展共享版本控制 error 类型、cause 保留和 detail 净化辅助，分离 operation event code 与 cause category，提供统一结构与 renderer，并迁移既有 code 的明确兼容映射。
- [ ] 1.2 修改 Git worktree discovery、revision/tree 读取、workspace/pending 查询和 index replacement，使 catch 保留可靠 cause，并按强信号分类 access、busy、tool、repository、revision、command 与 recovery 状态。
- [ ] 1.3 调整 index-runtime staging 对共享错误的映射，分别保留权限、冲突、普通写入和恢复失败的 event、cause、target、pending scope/outcome 与 recovery，不再统一压成宽泛 pending-write-failed。
- [ ] 1.4 修复 Decision Records 与 Investigation Report 的集合 mutation lock，只在真实 `EEXIST` 时报告 busy，并为权限、路径和未知 I/O 返回对应零写入诊断。
- [ ] 1.5 审计并迁移 Decision Records 的 Git 历史、stage、扫描、索引同步、生命周期、关系、discard 和恢复输出，移除重复包装并补齐 Decision ID、目标、mutation scope/outcome 与下一步。
- [ ] 1.6 审计并迁移 Investigation Report 的 Git 历史、stage-index、资源、同步、关系、discard 和恢复输出；补齐 mutation scope/outcome，让非阻断历史检查失败显式 warning，破坏性检查继续 fail closed。
- [ ] 1.7 完成两套 CLI 其余参数、来源、索引、关系和文件系统错误清单，修复裸 unavailable/could-not 文案，同时保持领域语义错误与系统错误分类分离。
- [ ] 1.8 更新两套 skill 固定契约、恢复指南和人类说明，固定阻断/warning、四种 mutation outcome、权限与锁的操作者动作以及不自动提权/删锁/重试的边界。
- [ ] 1.9 在共享诊断形成长期跨工具契约且验证完成后建立对应 Decision Record；普通文案修正不写成决策，并同步决策索引。
- [ ] 1.10 同步受影响公开类型、声明源、生成 CLI/source map/声明、skill 版本和每个新增或修改测试入口的 Test Evidence case 及派生索引。

## Verification

- [ ] 2.1 注入 Git 读取与 `.git`/工作区写入的 `EACCES`、`EPERM`，证明 cause category 为 access denied、目标和权限类型正确、对应 mutation scope/outcome 为 no change，且不误报 busy 或建议 sudo。
- [ ] 2.2 注入 mutation lock 与 Git index lock 的 `EEXIST`、并发 revision/pending 漂移和遗留锁场景，证明 busy/conflict 与 access/unknown 分离且 recovery 不自动删锁。
- [ ] 2.3 模拟 Git executable 缺失、非仓库、unborn HEAD、无效 revision、仓库策略和普通 stderr，证明分类采用强信号、unknown/detail 受控且必要维护 fail closed。
- [ ] 2.4 验证调查非阻断前序检查在 Git 不可用时输出 history-check-unavailable warning，决策历史和两套 destructive discard 不会静默降级。
- [ ] 2.5 覆盖写入前失败、写入后完整回滚、恢复不完整和提交后 cleanup 失败，断言 operation event、cause category、mutation scope/outcome、changed/unknown 状态与 CLI 说明一致。
- [ ] 2.6 对两套 CLI 的用户可见错误清单执行代表性集成测试，确认每条最终诊断包含可定位对象、原因或明确 unknown、mutation scope/outcome 和具体 recovery，且没有重复失败前缀。
- [ ] 2.7 验证 detail 的换行、长度、绝对路径和敏感模式处理，稳定测试只锁定 code/字段和必要文本，不依赖平台原始 strerror。
- [ ] 2.8 运行共享 version-control、index-runtime、两套领域定向测试、typecheck、生成物与测试证据检查及 `bun run check`，审计所有旧 error code 消费者已迁移。
