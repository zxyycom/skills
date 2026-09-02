# Tasks

任务先固定 Decision scaffold、命令退出与只读 preflight 契约，再实现创建和共享 lifecycle preparation，最后同步长期判断、分发产物与验证证据。

## Readiness

- [x] 0.1 核对当前 CLI 参数、candidate 扫描、查询、严格检查、lifecycle/relation preparation、集合锁、索引和 Git 历史 owner，记录 `new` 与 `--preflight` 的精确复用点和 blast radius。
- [x] 0.2 审阅 `separate-reviewable-candidates-from-established-decisions` 与当前候选规则，起草 successor Decision，固定 scaffold lifecycle、机械 body readiness、语义审核和 established 集合的边界。
- [x] 0.3 将已归档维护诊断 Change 的实际 DecisionApplicationResult、renderer、mutation outcome 和恢复文本映射到 `new` 创建失败及只读 preflight；确认创建成功后的辅助诊断不附会 mutation 字段。
- [x] 0.4 固定 `help new`、`activate --preflight` 与 `evolve --preflight` 的逐字段参数、重复关系形式、stdout/stderr、退出码和恢复动作；alignment 在 `new` 中仅为可选预演参数。
- [x] 0.5 盘点维护源码、公开声明、Schema、生成入口、skill 版本、现有候选/lifecycle/并发测试和 Test Evidence case，形成精确修改与验证清单。
- [x] 0.6 按 AI-Ready Docs 复核 proposal、design、tasks 和拟议帮助，确认 `scaffoldValid`、`bodyReady`、preflight、review 与 authorization 的含义从局部文本可以唯一恢复。

## Implementation

- [x] 1.1 更新 Decision Records skill、固定规则、恢复说明和人类介绍，先固定 scaffold、readiness、只读 preflight、创建成功与正式建立的责任边界。
- [x] 1.2 扩展公开类型与扫描记录，使合法 scaffold 与 mechanically body-ready candidate 分开表达，同时保持 candidate 排除于正式索引和正式关系图。
- [x] 1.3 实现 `new` 参数解析和规范序列化；在集合锁内重读跨 lifecycle 身份，以完整临时内容执行原子且不覆盖的 scaffold 发布，不暴露半写目标。
- [x] 1.4 为 `new` 分别返回和渲染 creation、body readiness 与辅助 preflight；创建成功后始终退出 `0`，alignment unresolved、attention 或 unavailable 不诱导重跑 `new`。
- [x] 1.5 更新 `candidates`、`show-candidate`、严格 `check`、计数和定位诊断，使合法 scaffold 可发现、展示、编辑和验收，非法结构与集合冲突继续阻断。
- [x] 1.6 收敛 lifecycle/relation preparation 为无写入核心，并让 `activate/evolve --preflight` 接受真实命令同构参数、返回 projected graph/index/history 结果且保持零写入。
- [x] 1.7 让正式 `activate/evolve` 复用同一 preparation 后重新加锁、重扫、检查漂移和执行 mutation；只接受 body-ready candidate，并重新要求 alignment、关系与历史确认。
- [x] 1.8 保持 `discard` 能删除 scaffold 与 body-ready candidate，接入新的扫描字段、引用检查、Git 确认、集合锁和恢复输出而不扩大删除范围。
- [x] 1.9 同步 Decision Records CLI 帮助、公开声明、生成 CLI/source map/Schema 和独立 skill 版本，不手改生成产物绕过源码 owner。
- [x] 1.10 在行为实施并验证后建立 scaffold/review 边界的 successor Decision，归档被替代判断并同步决策索引。
- [x] 1.11 为全部新增或修改的最小原生测试入口维护一入口一 case 的 Test Evidence Markdown，并同步统一测试证据索引。

## Verification

- [x] 2.1 验证 `new` 对规范 metadata、重复 tags/关系、非法 ID、已有 candidate/active/archived 身份、符号链接、锁失败和并发创建给出确定结果；输入或创建失败不产生目标。
- [x] 2.2 注入创建后的 body incomplete、alignment unresolved、关系 attention 与 Git/index preflight unavailable，证明 scaffold 保留、命令退出 `0`、输出分区正确且恢复文本不要求重跑 `new`。
- [x] 2.3 验证扫描、候选查询和严格检查区分 scaffold/body readiness；scaffold 不进入索引/正式图或被正式建立，补全正文后同一 ID 变为 body-ready，`discard` 可以安全删除两类候选。
- [x] 2.4 验证 `activate/evolve --preflight` 对单候选、归并、拆分、重划、relation override、discard 与 Git 历史门禁给出和真实 preparation 一致的结果，同时保持 Markdown、索引和 pending 字节不变。
- [x] 2.5 验证 preflight 成功、attention 或带确认参数均不产生 receipt；真实 `activate/evolve` 重新读取来源、索引、Git 和参数，对漂移再次阻断并要求本次显式确认。
- [x] 2.6 让 `new` 与 sync-index、activate/evolve、discard 和另一个 `new` 竞争，证明不会暴露半文件、覆盖身份或吸收无关工作，并核对 no-change/rollback/unknown 诊断只覆盖真实 mutation 范围。
- [x] 2.7 运行 Decision Records 定向测试、类型检查、生成物一致性、Decision/Test Evidence 索引检查及 `bun run check`，并审计 diff 只包含本 Change 可归因范围。
