# Tasks

按 [design 的批次 0→6](design.md#分批替换与退出顺序)实施，每批完成实现、验证与直接影响同步后退出。
Readiness 只证明计划可接手；Implementation、Verification 按实际证据勾选，全勾后按授权保存完成态并结项。

## Readiness

- [x] 0.1 核对用户批准的五组产品保证已准确进入 design G1–G5，尤其无关系 content 不强制验整图、全量 check 首次采集、候选恢复边界及提交后验收/清理分离；
  确认 Open Questions 无阻塞，未把批准误记为实现通过。
- [x] 0.2 审计共同 owner/领域/stage/独立分发边界、proposal 成功标准与全部批次任务覆盖；
  确认同阶段 proof 与独立 fresh、两项纠错、按批退役及直接稳定 owner 同步均可追踪。
- [x] 0.3 按仓库 ai-ready-docs 审计三个 artifacts 的当前状态、术语、owner、前提/例外和可恢复阅读路径；
  确认方案表达为当前确定选择，不因去重丢失安全及领域差异。
- [x] 0.4 完成计划结构及本 Change 引用检查，通过 `bun run change-plan -- plan changes/unify-record-operations` 建立 Plan 基线，再用 `check`/`show` 核对 stage、计数和真实进度；
  此项不代替未来产品 Gate。

## Implementation

[阶段 0–3 交接](stage-0-3-handoff.md)与[阶段 4–6 交接](stage-4-6-handoff.md)保存各 checkpoint 的实现、审查及执行证据；最终性能结果和未覆盖项从[证据入口](evidence/README.md)恢复。阶段记录不代表后续代码优化或最终 Gate 已通过，进度以下列勾选为准。

各批共同要求：

- 主要实现由 6.1sol 子代理承担，阶段审查只看正确性；审查通过才勾选对应工作。
- 按 [design 的影响范围](design.md#文档决策与分发影响)同步稳定 owner、公开声明、构建生成闭包、skill 独立版本与测试证据。
- 删除当批旧共同流程、失去消费者的 helper/测试，只同步和验证实际受影响项。

- [x] 1.0 批次 0：复核 Context 的源码接点与当前 Git/owner，按 design 的 1W 口径冻结两域 fixture、有限代表清单、热点各 3 次/其余 1 次、计时与后验/reset 方法，取得可重复同口径 baseline；
  不跑 100K，不把旧侦察或历史报告当作本次 baseline。采用现有 fixture/测试归属，临时测量物有明确退出位置。
- [x] 1.1 批次 1：修复 IR trace 成功成员不闭合、候选创建后解锁失败丢失实际创建事实两项结果错误；
  文本/JSON 保留同一真实事实，不依赖其余优化才交付纠错。
- [x] 1.2 批次 1：接入最窄 `tools/record-operations/`，收口 sync/source snapshot、selected selector/baseline 准备；
  同阶段 definition/身份/字节/严格证明交接且不改变完整来源、未选保护、最终独立 fresh。接入前按决策流程修订关系输入决策的“不提取跨工具运行时组件”限制，并落实依赖/构建 owner，不先建框架。
- [x] 1.3 批次 2：收口正式 query/selector、字段物化、metadata 返回窗口、图 context 与安全 show；
  落实 G1/G5，关系筛选/trace 每发布投影完整领域图一次，无关系 list/metadata/show/content 不附加全域图门禁；
  raw 外部输入仍严格验收，安全大正文完整读取。
- [x] 1.4 批次 3：接入 new/readiness/candidates/show-candidate，落实 G3 的 target ID 语法、动作选择集合、单坏候选 warning/显式目标失败、无索引候选身份发现和必要依赖失败；
  复用 ID→source 映射，删除额外 CLI 全集 readiness 回读，不隐式恢复正式索引。
- [x] 1.5 批次 4：统一 publish/set-relations 普通事务及 DR 无删除 evolve、mark-aligned、archive/reactivate 的共同安全写集；
  保留领域闭合、alignment/createdAt、formedAt/资源 owner 等职责。落实 G4 的锁内重新准备/fresh、unchanged 保护、索引提交点、实际字节/相关来源成员写后验收及真实结果映射；
  完整 replacement/review 只在适用的成功路径输出。
- [x] 1.6 批次 4：随普通事务建立 G5 实际写集归属与 CAS 恢复，区分提交前完整 rollback、partial-or-unknown、提交后验收失败/未知与 cleanup-only；
  清理/解锁失败非零且保留 mutation，不鼓励直接重试。覆盖不发布正式索引的候选 create/rename/discard 各自实际提交点与真实结果，不为统一而写正式索引，不为结果表达建立通用框架。
- [x] 1.7 批次 5：接入严格 rename/discard/带删除 evolve 及恢复；
  交接同阶段 layout/scan/候选映射但保留锁前预演、锁内准备、写前 fresh、写后验收的独立义务，保留全集来源/历史确认/资源 owner 规则；
  落实真零写 no-op、末条合法空索引及 CAS 冲突保护；
  不发布索引的候选 rename/discard 保留各自动作提交点。
- [x] 1.8 批次 6：按 G2 收口两域全量只读 check 为首次采集身份/源字节/资源与完整预期索引，不做结束全集重读、不外溢 IR 单项 scope；
  sync/事务独立 fresh 继续保留。盘点两域全部非 stage 命令族和直接调用，清除绕过共同 owner 的重复编排、退役 helper 与重叠测试；
  stage 保持现有实现。
- [x] 1.9 最终优化：派发优化子代理，按 ai-ready-docs 优化实际受影响文档，按 `docs/coding-style.md` 从整体责任边界及风格审核、优化代码；
  保持 G1–G5 和独立分发，不做无关重写。优化后的改动回到相应正确性/生成验证，不把优化审查当作功能验收。

## Verification

每项记录命令/入口、fixture、实际结果和未覆盖边界，按批归位并复用有效证据。
共同契约测试维护一份并对两域适配器执行，领域行为及 CLI/SDK 集成独立证明。
性能与 Gate 串行且分开报告；保证变化与同保证机械收益分列。

- [x] 2.0 批次 0：核对 baseline 输入、fixture HEAD、公开入口/计时封套、采样次数及独立后验可重复；
  冻结代表清单和当前行为差异，记录 read/parse/build/graph 分离采样方法，不预设倍数收益。
- [x] 2.1 批次 1：小 fixture 证明缺 target trace 必须失败，合法 trace/context 互斥且并集等于 entries；
  对候选已创建后解锁失败注错，核对非零、真实 ID/sourcePath/created/changed 与无成功 review，不能报未创建。
- [x] 2.2 批次 1：共同 sync/proof 测试证明 definition/身份/字节不匹配拒绝复用、同阶段准备去重；
  selected 完整来源/未选变化/baseline metadata/revision/最终 fresh 保护不降。取得受影响 full/selected 单改 1W 前后配对与独立字节/entry/revision/未选后验。
- [x] 2.3 批次 2：用同一坏领域图覆盖无关系 list/metadata/show/content 可按实际依赖成功、关系筛选/trace 必须完整验图失败；
  需要的资源/来源安全失败仍拒绝。核对每投影一次图/目标一次解析、零命中/超窗口/多条件精确计数、排序证据/coverage/文本JSON及外部 raw 查询严格门槛。
- [x] 2.4 批次 2：CLI 与公开 API 小 fixture 证明 canonical workspace/collection、外部及父组件 symlink、路径/inode/字节身份替换、非法 UTF-8 拒绝；
  show 大于搜索预算仍返回完整正文且不套 preview 限额。完成小窗口/关系/content 受影响 1W 代表配对，保证改变单列。
- [x] 2.5 批次 3：覆盖未来完整 target ID、name 零/唯一/歧义、候选与正式同名、warning/skip 与明确坏目标失败、可见重复身份/非法成员、同日/legacy/目标不覆盖；
  证明合法索引、真正无索引、已有坏/不兼容索引分支和必要依赖失败，不把 header 证据当发布事实。取得 new/单项 readiness 1W 代表配对，publish 全局闭合门禁不降。
- [x] 2.6 批次 4：证明批 publish 的同批闭合与未选候选保护、set-relations 完整 replacement/review、DR 独有生命周期及 IR 资源依赖；
  验证无写锁预检即使合作锁 busy 也不以 busy 优先拒绝、零写入无凭据，实际执行锁内重新准备/fresh；
  在预检→执行、准备→fresh 间漂移及 unchanged 路径拒绝失效事实，其他机械错误顺序保持。
- [x] 2.7 批次 4：按实际写入阶段注错，覆盖提交前恢复、索引发布后 readback 失败/未知、仅临时清理失败、仅解锁失败及验收+清理同时失败；
  核对 G4 的 CLI/SDK/文本JSON/退出、真实 mutation/路径和成功 review 禁止。CAS 插入后来修改/新建、mode/identity 漂移及未写成员，证明不覆盖 winner、旧路径仅缺失时独占恢复、index 同 CAS，只有完整证明才 rolled-back。
- [x] 2.8 批次 4：完成单候选 publish/常数小批及关系替换受影响 1W 配对，独立核对来源/资源 bytes+mode、entry/revision、完整未选状态；
  同保证回退复核并处理，保证强化成本另报，不用失败样本宣称收益。
- [x] 2.9 批次 5：证明严格全集来源/成员/历史/资源 owner 义务及各独立阶段保留；
  同 ID同路径 rename 必要安全通过后 bytes/mode/index 真零写、不需历史确认且不规范非规范正文；
  删末条留下合法空索引、后续查询/publish 可用。候选 rename/discard 无索引发布时核对各自提交点及真实收尾结果，不新增正式索引写入；
  逐写入故障和 CAS 扩展至 rename/discard/删除 evolve，完成单对象 rename/discard 1W 代表配对及独立后验。
- [x] 2.10 批次 6：小 fixture 在全量 check 采集完成后、返回前插入外部编辑，证明首次采集而非结束新鲜/原子快照的边界，采集中安全仍严格；
  核对 IR 单项 scope、sync/事务 fresh 未降。全量 check 1W 代表只做已冻结次数，不重跑完整性能矩阵。
- [x] 2.11 批次 6：完成命令族/直接调用 owner 盘点，核对 stage 与其他 Index Runtime 消费者无回退；
  各 skill 独立生成/安装/运行不依赖另一 skill 或仓库路径，维护源仅一份、构建闭包/公开导出/持久格式不扩张；
  对应决策、规则、help、README、声明、版本、Case/索引与退役状态一致。
- [x] 2.12 优化完成后按影响复跑必要原生/生成与集成检查，运行 `bun run check:changed` 或 CI 全量门禁；
  核对全部批次证据、未覆盖边界及无稳定机械回退，报告产品改变成本与实际验证。quick check、计划结构检查及 Readiness 不替代本项；
  结项动作不作全勾前置。
