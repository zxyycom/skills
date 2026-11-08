# 原生记录 CLI：写入、文件与 Git 调查证据

采集日期：2026-11-08。本文依次说明源码阶段、采集方法、实际覆盖和规模观察；准确调用与后验见原始 JSONL。根 HEAD `c1161cf1db52cf2de9ba5e0829808e18ebdccf19`。release DR SHA256 `42bdfe5113c4a6ffa404efa54eb68f42a42003a92f51e3529b5ddd5ef8fe2a6b`；IR `1e1aa4a14553239e2cbe22723d738ee53b3dc46b53ba9a355add3825c453ab20`；manifest 316 路径逐字节对照 `dist/record-cli-perf-261107-main/source/` 和当前 `tools/record-cli/` 均相同，manifest source sha `88c5ecaa22b7a42ba660b7c14a3e0c5300c85fb4174c5fc818792b25d976c072`；这证明文件内容相等及给定二进制身份，非重建证明。

所有源码路径相对 `tools/record-cli/src/`。领域入口 `cli/mutation/{decision,investigation}.rs` 和 `services.rs`、`cli/arguments/`；共同 `transaction.rs` 先 prepare、validate，再顺序执行 resource intents 和实际变化 writes，已有文件原子替换，新建 create_new；无跨阶段重读、后验或回滚承诺。预检是独立调用的 prepare，不能代替正式写入或外部后验。

| 域/命令 | 静态执行与规模工作量（正常工作并非异常） | 已测代表（限制见动态结算） |
|---|---|---|
| DR new | `mutations/authoring/mod.rs`、`discovery.rs` 枚举身份/候选和路径，render、create_new 候选；存在 N 索引、C 候选与输出正文输入成本 | 真实候选创建。 |
| IR new | 同上，IR 模板/资源检查；候选单文件 | 真实候选创建。 |
| DR publish | `authoring/decision/{mod.rs,collection.rs,successors.rs,writes.rs,history.rs}`：基线与成员发现、候选 header、选择全文、图及历史、归档前序、完整索引序列化/写 | 预检零写与实际发布。 |
| IR publish | `authoring/investigation_publish/{mod.rs,collection.rs,resources.rs,writes.rs,history.rs}`：多候选 header、所选全文、资源引用、历史 warnings、最终完整图和索引 | 预检零写与实际发布。 |
| DR evolve | `authoring/decision/{mod.rs,selection.rs,dependencies.rs,writes.rs,history.rs}` 同一次处理多个后继、前序、可选 discard，合并图并完整索引 | 单后继预检与实际发布。 |
| DR archive | `decision/lifecycle/operation/archive.rs`、`preparation.rs`：选目标、检查 HEAD 与未记录历史，再变更所选源和全索引 | 未记录历史拒绝及显式确认后实际归档。 |
| DR mark-aligned | `decision/lifecycle/operation/mark_aligned.rs`、`preparation.rs`：active unaligned 到 aligned、选源验证及完整投影 | unaligned 到 aligned 实写。 |
| DR reactivate | `decision/lifecycle/operation/reactivate.rs`、`preparation.rs`：archived 到显式 alignment、路径变化、完整投影 | 预检及正式状态转换。 |
| DR set-relations | `decision_relations.rs`、`decision_relations/{sources,projection,review}.rs`：读取选源，review 与最终图、全索引序列化；没有实际修改时 no commit | no-op、预检、正式实写。 |
| IR set-relations | `investigation_relations.rs`、`investigation_relations/transaction.rs`：读取所选正式源、重写及合并图/全索引 | no-op、预检、正式实写。 |
| DR rename | `identity/decision/{phase,discovery,change,references,history,pending}.rs`：索引和候选 header 发现，真正 no-op 提前退出；实际改名获取正式引用者，选源/实际改写来源，HEAD/pending 保护，正式重写全索引 | 正式预检/实写/历史门禁、候选更名、真正 no-op。 |
| IR rename | `identity/investigation/{phase,discovery,change,references,owner,history}.rs`：候选/正式发现；资源目录现存则捕获资源树、验证归属，普通目录 rename；正式引用及索引重写 | 正式预检/实写/历史门禁、候选更名、真正 no-op；IR 候选资源移动。 |
| DR discard | `identity/decision/{phase,change,history}.rs`：索引全图引用排除、目标历史门禁；candidate 不写 index，formal 重新写 index | 候选及正式删除。 |
| IR discard | `identity/investigation/{phase,change,change/discard_plan,owner,history}.rs`：资源树/正式引用/历史检查；资源删除需确认；candidate 不写 index | 候选及正式删除；IR 候选资源显式删除。 |
| DR check | `mutations/check/decision.rs`、`decision/sources.rs`：遍历并校验 formal/candidate，全索引完整比较；**无 selected**，非空 ids 拒绝 | 全量 check；DR 不支持 selected。 |
| IR check | `check/investigation.rs`、`check/selected.rs`、`check/investigation/{initial,resources,sources}.rs`：全量读取来源、资源、图/索引；selected 通过索引定位，失效或缺失时扫描成员 header，仅选源全文 | 全量及 selected check。 |
| DR sync-index | `sync/{decision_sync,decision_selected_sync,full_sync,selected_sync}.rs`：full 借 check 全源构建；selected 可信 baseline+所选源，组合/验证/完整索引 | full/selected，预检/实写/current no-op。 |
| IR sync-index | `sync/{investigation_sync,investigation_selected_sync,full_sync,selected_sync}.rs`：full 完整来源/资源，selected 可信 baseline、所选/必要依赖和完整组合图/索引 | full/selected，预检/实写/current no-op。 |
| DR stage | `stage/{index_scope,decision_scope}.rs`、`index_scope/{history,acquisition,pending}.rs`、`decision_scope/discovery.rs`：HEAD/index/pending 取证与组合；index 不读正文；all/domain 读取所选正文；pending-only 无可信定位会拒绝 | all/index/domain 各实际写入与选中/未选后验，K 扩大及 P=2003 的保护审计；P=503/1003/2003 的 timing 仅 DR index no-op。 |
| IR stage | `stage/{index_scope,investigation_scope}.rs`、`investigation_scope/{discovery,resource_selection}.rs`：index 同上；all/domain 选报告与 owner 资源，以及适用直接引用资源和 Git mode | all/index/domain 各实际写入与选中/未选后验，K 扩大及 P=2003 的保护审计；IR 含 owner；三档 P timing 未在 IR 测。 |

## 规模变量与源码阶段

- N 发布索引存量、C 候选数及 header 字节、K 所选对象（并单列真正改写引用者数 R）、图边数 E、索引字节/全文字节、资源文件数 F 与总字节 B、Git HEAD 下目标数 H、pending 条目 P、实际更新文件数 T 不能混为单一 N。
- `git/selected.rs:44-69` 在选中路径上查找 pending membership（线性 filter）；存在条目各有 `cat-file -t` 和 blob 读取；`git/publish.rs:100-125` 为保护未选 pending 对每个非删除目标扫描 pending 条目并检查目标间祖先后代冲突。下文 P 对照未显示该范围显著恶化，真实写入及 T/P 交互仍待隔离量化。
- `stage/investigation_scope/resource_selection.rs` 对选 owner 和直接资源建立 scope，`git/workspace.rs` 和 `git/revision.rs` 按 pattern 分别调用 Git。下文 K=8 no-op Trace2 给出特定 scope 的调用计数，完整 scope 与输入分布的关系仍待比较。
- `mutations/identity/{decision,investigation}/discovery.rs` 均扫描目录成员并读取候选 header；不是读取全部未选正式正文。资源捕获普通目录树不是纯 rename 的成本；观察同时报告文件数及字节，不预设 K²。
- `check/selected.rs` IR 在索引定位失败时才走合格成员 header 回退；明确分开稳定索引定位与回退，不把后者说成所有 selected。

## 采集与独立核验

两域在小规模私有 Git fixture 中初始化本地 HEAD 和受控 pending，按状态顺序分组运行。fixture 准备、候选补全、建库、提交及命令后的检查均在 wall 之外。原始记录保存 argv、结果、文件差异和 pending 对账；独立读取正文、索引、资源及 Git blob，核对预期变化和未选保护。

采集先覆盖入口与合法行为，再选取 K、历史共享目标和 P 三个规模方向。实际重复数见下文；小样本以原始值呈现。原始失败保留，并通过补测区分调查准备问题与产品行为。

## 动态覆盖与限制

环境 Linux 6.18.33.2 WSL2 x86_64、ext4、6 vCPU、AMD Ryzen AI 7 H 450、Git 2.53.0；OS 缓存未清理，进程均为新进程；准备和事后验证不计入下表命令 wall。n32 原 fixture 67 文件 62,248 B、DR/IR 索引各 32 条，关系边分别 15 / 18；n250 原 fixture 503 文件 451,339 B、DR/IR 各 250 条，关系边分别 23 / 30。对排序后的全部文件逐项写入长度前缀路径与长度前缀文件 bytes 的 SHA256：n32 `edc7eb9978f9bd88b3b0b45db2c57908c314c8c05e5b746838d8e7c420b2d495`；n250 `da725b119647b709aa6521d561391013cda8474c258b5a8643fe828d0243aef2`。复制自前轮只读 fixture，未更动源 fixture。`wide.jsonl` 逐项保存完整 argv、JSON、stderr、wall、全 docs 文件 hash delta 以及无关 sentinel pending 对账；`scale.jsonl`、`history-edges.jsonl`、`pending-scale.jsonl`、`unselected-audit.jsonl` 保存独立探针的 argv 与结果。JSONL 全文为随附证据，私有 fixture 另留于当时调查目录；两者均不构成公开性能基准或长期测试。

私有 Git：n32 初始 HEAD `b4617b598cdef032bfda0fb99dc23ee07a9a8b1a`，无关 `unselected.txt` HEAD=`baseline`、pending=`pending`、worktree=`worktree`；n250 scale 初始 HEAD `6361fd27bf3ddf773fb4d2129828679f7a2e8101`，相同三态 sentinel，初始 index membership P=503；P 是 `git ls-files --stage` 全体条目，不是相对 HEAD 的 staged 变化数。数据准备、手工将候选补成 body-ready、独立 `check`、Git 建库与提交都在目标调用计时外。记录按 fixture 顺序发生，后续命令不与初始状态等同。

| 入口 | 动态观察与核验 | 尚未覆盖 |
|---|---|---|
| DR / IR new | 两域真实创建；实际来源新增、结果 `created`/ID/readiness，DR 另与后续 body 编辑区分 | 冲突、资源不 readiness 和全部参数组合。 |
| DR / IR publish | preflight 未改变 docs/pending；实写分别 2 / 3 文件 delta，发布索引出现新 ID；IR 候选退出；以新候选无关系为代表 | DR 前序自动归档、IR 多候选/资源引用 publish 尚未动态测。 |
| DR evolve | 新候选 `--successor aligned=...`，preflight 和实写均成功，预检零写，正式索引出现 ID | 单后继预检与实际发布。 |
| DR archive / mark-aligned / reactivate | 新发布的 unaligned→aligned，未入 HEAD archive 拒绝且零写，显式 `--keep-unrecorded-history` 归档；reactivate 预检零写与实写；独立检查索引 status/alignment | archived/reactivate 状态不合法、已提交 archive；archive 拒绝的是未记录历史，并非已记录删除确认。 |
| DR / IR set-relations | 空关系 no-op 实际 `changed:false` 且无 delta；preflight 零写，正式各改来源+索引，独立核对 1 条期望关系 | 批量关系、图闭合与不合法输入。 |
| DR / IR rename | 正式记录的 HEAD 门禁零写拒绝、预检和带确认真实改名，索引旧 ID 消失新 ID 出现；候选更名与同 ID 同 sourcePath 真 no-op（`noChange:true` 和无 delta）；IR 候选资源树移动后核对字节 | 正式带资源 owner 及引用改写、并发、更多候选及影响引用者。首轮 DR 因先前 stage 留域内 pending 触发预期保护；仅私有 fixture 恢复决策域 index 后完成正式历史测试。 |
| DR / IR discard | 候选及正式实际删除，正式索引旧 ID 不再存在；IR 候选 owner 用显式资源删除，核对目录退出 | 已记录目标拒绝后确认、正式 owner 资源删除及被引用拒绝。已更名的正式目标不代表 HEAD 已记录同一新身份。 |
| DR / IR check | DR full；IR full 和 selected；selected 与 full 在改源后同步成功，事后 full check 成功 | DR 无 selected；IR 失效索引 fallback、无关损坏正文与资源损坏未测。 |
| DR / IR sync-index | full/selected 各有 preflight、current no-op 和真实写入；修改所选或全量源、实写仅索引 delta、事后 full check 成功 | 新增/删除身份、坏基线及未选正文破损；事后全量检查不进入计时。 |
| DR / IR stage | index/domain/all 各有不同 source 编辑、sync 和实际 stage；独立对比 index scope 不改变选中 pending 源、domain 不改变 pending 索引、all 两者正确；按 scope 校验选中 staged 字节/索引 ID revision、无关 sentinel；IR domain 资源 owner 的已选文件 staged 字节等于工作区且另一个 owner 的 pending 不变。另 n250 + P=2003 对两域 all 各完整比对 index membership，2001 个未选条目无变化、恰有选中源与索引两项变更。 | 缺失 HEAD 索引、unborn、索引路径冲突、foreign direct resource、二进制大资源和故障注入未测；不能推断非合作并发或跨文件原子性。 |

**原始失败不可混作产品异常。** `wide.jsonl` 的 11 个 `errors` 是测试预期/准备错误：首次 DR new 少 tag；DR pending 保护导致预期 rename/其下游 discard 不成立（`d-rename-history-refusal` 初次虽预期 exit=1，实际是 pending 而非历史，后有独立 `d-rename-recorded-refusal`）；IR 已有同 ID 但源路径不符合目标分配，发生真实更名而不是 no-op，历史门禁也因此先起作用；DR title 太短造成候选后续缺失；两域 `new` 的初始候选路径含日期，same ID 并不等于同一 sourcePath，随后规范化使它们产生实际移动。补测已先正常化路径再证明真正 no-op。IR 候选文件无 `.md`，首次测试 glob 找不到导致 Python 停止，后从原 fixture 接续。历史探针原脚本把未跟踪的原 fixture.json 误计入 Git dirty；32正文+索引变更和本地 commit 已完成后脚本停止，continuation 基于同一个已提交私有 HEAD 完成后半部分。

## 规模与工作量观察

1. **实际写入 stage 的所选 K**：N=250、初始 P=503，选中且已独立修改正文、selected sync 后按 all stage。DR K=1/8/32 一次分别 **119.104 / 214.895 / 507.320 ms**；IR **138.722 / 284.094 / 866.885 ms**。32 条选集与 1/8 为不同 ID、累积运行；逐项读 pending blob 对照选中工作区全文，无关 sentinel 保留。选择增加还伴随更多输入/输出/文件写入/保护，并非控制所有变量的算法复杂度证明。所选源各自同一原 fixture 规模，未测试重复次数或跨机器外推。
2. **Git 子进程计数（单独 Trace2、no-op stage）**：同 n250 的 K=8 已 staged 目标，单独启用 `GIT_TRACE2_EVENT`，DR 41 / IR 87 个 Git `start` 事件。DR 包括 10 `cat-file -t`、11 `cat-file blob`、11 `hash-object --stdin`；IR 18 / 19 / 19，另 8 `ls-files --cached`、10 `ls-tree -r`。这里的 hash-object 无 `-w`，用于 `git.rs::read_blob` 对读取对象身份再核对；不可把这些 no-op 次数直接归因到上一项的实写 wall。日志为 `d-stage-k8.trace.jsonl` / `i-stage-k8.trace.jsonl`，trace 会扰动。
3. **IR 全量 check 的历史目标重复读取**：私有 n250 固定 N=250，合法操作将 32 个原无关系源分别增加一条指向同一个已记录目标 `260101-record-00026` 的补充边，独立 hash 对账恰有 32 正文+索引变化并在私有仓库提交。实际关系边 30→62，唯一历史 target 恒 22，该目标出现次数 8→40；无 Trace2 的 check 分别 **177.238 / 191.952 ms** → **321.522 / 340.657 ms**（每组 2 次）。另外启用 Trace2 的独立调用，Git start **98→194**，`ls-tree` / `cat-file blob` / `hash-object --stdin` 各 **31→63**，增量 3×32。源码 `mutations/check/history.rs::recorded_history` 逐关系而非逐唯一 target 读取固定 HEAD 的来源并核验 mode / identity；`git/revision.rs` 与 `git.rs::read_blob` 分别调用 tree、blob、hash。保留历史语义检查和逐边 warning 的前提下，单次固定 revision 对相同目标复用历史事实是有证据的候选；不声称删减保障，不证明复杂图和生产 TS 同行为。
4. **P 是 index membership 大小而非已改条数**：固定 N=250、K=1、DR index-only 已选目标 no-op，在私有 fixture 向域外额外 stage 0 / 500 / 1500 个独立小文件，P 分别 **503 / 1003 / 2003**；每组 3 次 **32.851、29.821、28.981 / 30.955、35.182、34.402 / 33.699、36.800、35.005 ms**。每次前后完整 `ls-files --stage -z` 字节相等，sentinel pending 相同。此范围看不出明显的巨大增长；并不排除更大 P、不同目标数和真实写入时的交互。不要把源码里 T×P 检查直接升级成当前场景已证实瓶颈。

本次没有实测 CPU/RSS、冷缓存、单阶段细分、跨平台、真实生产记录、并发/竞争或发布验收；也没有为优化进行生产代码变更、新增公开基准、测试和 Case。记录中每个 wall 都是启动到收集 stdout/stderr，少数样本不计算 P95，单次量仅作为线索。fixture 和测量脚本仅在本次私有调查目录。
