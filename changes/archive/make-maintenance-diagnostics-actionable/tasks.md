# Tasks

任务先以矩阵完成可审计的诊断与事务边界，再由共享层、领域事务和 CLI 分层实施，最后用故障注入验证即时输出、字段和恢复建议。

## Readiness

- [x] 0.1 建立并写入 `diagnostics-matrix.md`：按已知用户可见类别覆盖两套领域 CLI 与共享调用链，明确 owner、字段、输出和测试策略；逐调用点盘点仍待实施前完成。
- [x] 0.2 固定普通错误与系统错误的最低字段，以及只有 mutation-capable 失败才具有 `scope/outcome` 的边界；矩阵与 proposal/design 已互相校验。
- [x] 0.3 逐一盘点矩阵各类别的实际 producer、最终 renderer、旧 `VersionControlError.code` 直接消费者、当前退出码和真实提交/恢复点；把发现的同类遗漏并入矩阵，不把未核对项视为完成。
- [x] 0.4 审阅 `prepare-record-candidates-before-establishment` 的依赖：其新命令仅消费本 Change 的分类与 renderer，未就绪前不复制临时错误协议。
- [x] 0.5 按 AI-Ready Docs 语义复核 proposal、design、tasks 与矩阵，确认普通错误、系统错误、mutation 失败、warning 与 stdout/stderr/退出码边界可从局部文本恢复。

## Implementation

- [x] 1.1 扩展共享版本控制错误的 operation event、cause 保留、可靠 cause category、target 和 detail 净化；保持 shared 不拥有事务 `scope/outcome`，并为旧 code 提供必要的显式兼容迁移。
- [x] 1.2 修改 worktree discovery、revision/tree 读取、workspace/pending 查询与 index replacement，保留可靠 cause 并仅按强信号区分 access、busy、tool-unavailable、not-repository、revision-unavailable、command-failed 与 unknown；recovery 由稳定 code 和所属事务结果表达，不从 stderr 猜测 `repository-policy`。
- [x] 1.3 调整 index-runtime staging 的 shared-error 映射与提交/恢复阶段，使 pending scope/outcome 只由 staging owner 设置，不再把权限、冲突、普通失败和恢复失败压成同一提示。
- [x] 1.4 修复 Decision Records 与 Investigation Report collection mutation lock：只有确认 `EEXIST`/冲突时报告 busy；权限、路径和未知 I/O 保留真实原因与零写入或相应事务结果。
- [x] 1.5 按矩阵迁移 Decision Records 的参数、扫描/查询、索引、Git history、lifecycle、stage、关系、discard 与恢复诊断；普通错误补齐 code/对象/原因/下一步，mutation 失败才补齐 Decision scope/outcome。
- [x] 1.6 按矩阵迁移 Investigation Report 的参数、来源/查询、索引、关系/history、资源、stage-index、sync、discard 与恢复诊断；非阻断历史检查明确 warning，破坏性检查继续 fail closed。
- [x] 1.7 实现或接入两套 CLI 的最终 renderer，去除重复失败包装，输出即时恢复文本；保持成功 stdout、失败/warning stderr 和现有退出码，不新增日志、遥测或 receipt。
- [x] 1.8 更新两套固定契约、恢复指南和人类说明：明确 stdout/stderr、阻断/warning、四种 mutation outcome、权限/锁的操作者动作，以及不自动提权、删锁或重试的边界。
- [x] 1.9 盘点并同步实际 direct consumer：Change Plan、Decision Records、Investigation Report、Test Evidence 与 Task Graph；五套生成 CLI/source map 及受影响声明/Schema 已同步。对应 skill 版本已提升，并已建立经 CLI 对齐的跨工具 Decision Record。
- [x] 1.10 为本 Change 新增或修改的每个最小原生测试入口维护一入口一 case，并已由 `sync:test-evidence-catalog` 重建统一索引。

## Verification

- [x] 2.1 以矩阵为审计出口：每行都有实际 producer、最终输出路径和测试证据；新增同类已知失败已归类，普通失败不含虚构的 mutation 字段。
- [x] 2.2 注入 `.git`/工作区 `EACCES`、`EPERM`、`EEXIST`、未知 I/O、并发 revision/pending 漂移与遗留锁，证明 access、busy、unknown 和恢复动作区分正确，且工具不建议 sudo 或自动删锁。
- [x] 2.3 模拟 Git executable 缺失、非仓库、unborn HEAD、无效 revision、普通 stderr 与不具稳定机器信号的仓库策略文本，证明强信号分类、受控 detail、`command-failed`/`unknown` 回退以及必要维护 fail closed。
- [x] 2.4 验证 Investigation 非阻断前序检查在 Git 不可用时输出 `history-check-unavailable` warning；Decision history/lifecycle 与两套 destructive discard 不静默降级，并只在 mutation-capable 命令中报告可证明的 outcome。
- [x] 2.5 覆盖写入前失败、写入后完整回滚、恢复不完整和提交后 cleanup 失败，断言 scope/outcome、changed/unknown 状态与 CLI 说明只覆盖所属事务范围。
- [x] 2.6 对两套 CLI 的矩阵类别运行代表性集成测试，确认最终诊断至少含 code、对象、原因和下一步，系统错误按证据补充 cause/detail，且没有重复失败前缀。
- [x] 2.7 验证 detail 的换行、长度、绝对路径和敏感模式处理；稳定测试锁定字段与必要文本，不依赖平台原始 strerror，并确认成功 stdout、失败 stderr 与退出码未变。
- [x] 2.8 运行 shared version-control、index-runtime、两套领域定向测试、typecheck、生成物与测试证据检查及 `bun run check`；审计 diff 未吸收无关 Change。
