# 三切面审查与交叉审核（形成时辅助材料）

2026-11-10，3 名 gpt-6.1-terra 调查代理与另 1 名独立 gpt-6.1-terra 审查代理。主代理独立复算 Trace2 总数并整合；此文件由各切面交接提炼，非长期规范。

## 历史优化核对


源码 HEAD 4fdeb5581defcffedf65159b2fc52c58610c7598；TS 参照 a88af9bc029a1539c3abe57f69d752e4d39a868e。只读源码与报告，无本轮性能采样；以下源码工作量不是端到端回退证明。旧版本路径行号为 `git show a88af9bc:<path> | nl -ba` 行号。

| 旧优化／错误及证据 | 当前公开入口和实现 | 状态和边界 |
|---|---|---|
| `docs/investigations/261107-record-cli-native-complexity.md:38-60` 多词预览扫描所有 Q heads，重叠命中 R 时 Θ(QR)。 | 两域 content search；`tools/record-cli/src/queries/matcher.rs:111-150` 按范围排序 BinaryHeap、每次推进一个 head。 | **已修复旧候选**：候选选择不再逐次扫描所有 Q；仍须处理合并范围与连续重叠，保留 UTF-16 和截断语义，非所有匹配工作都降为常数。 |
| 同报告 62-75；TS `tools/record-operations/src/synchronize.ts:95-118` 建立名称映射一次；`tools/investigation-report/src/query/selected-sync.ts:26-43` → `tools/record-operations/src/selected-synchronize.ts:140-145` 接线。 | 两域 `sync-index --preflight --select`（正式 selected 同构）；`tools/record-cli/src/mutations/sync/selected_sync/baseline.rs:220-233,261-273` 逐选择器调用 `src/domains/mod.rs:184-206` 的全索引名称过滤。 | **旧调用内批量名称查找确定丢失，源码工作量退化**：K 名称 N 条约 Θ(KN)，旧建表再查找近 Θ(N+K)，同名歧义排序另计。261107 原生测样提供机制与当时 wall，不构成 TS/Rust 端到端比较。 |
| `docs/investigations/record-stage-convergence-10k.md:103-110` index-only 缩小 pending payload 而不是取消完整成员检查；`docs/investigations/investigation-local-stage-and-single-read-check.md:39,80-91` 正常 selected 阶段访问局部且安全复核留存。TS `tools/shared/src/version-control/git/pending/git-pending-snapshot-content.ts:14-32` 将选中 OID 聚合到 `git-blob-batch.ts:23-40` 一个 `cat-file --batch`。 | 两域 `stage --scope all/domain`；IR `src/stage/investigation_scope.rs:215-250` 收集选中源与资源传给 `src/stage/source_capture.rs:155-170`，再进入 `src/git/selected.rs:24-56,64-68`；每个待取路径扫描 pending，并每 blob 分别执行 `cat-file -t`、`cat-file blob` 与 `hash-object --stdin`。`src/stage/index_scope/pending.rs:163-174` index scope 仍只选择 index payload。 | **batch 获取机制丢失，源码工作量退化**：B 个路径与 P 个 pending 成员可能 B×P 比较、每个 blob 三个 Git 子进程；旧数据粒度、去重与安全失败语义需对照。仅此不能声明已量化回退。正常选中 payload 范围仍局部；完整 pending、关系、投影和必要 owner 仍有集合工作。 |
| `docs/investigations/261108-record-cli-native-complexity-survey.md:55-65` 单资源 owner 的资源验证线性 `contains` 导致 R(R+1)/2，R=2000 有固定输出实际入口守卫。 | IR graph 验证（包括 trace、sync 和 full check）；`src/domains/investigation/graph.rs:6-16,21-30` 仍逐引用遍历 owner 的 Vec。 | **原生已知候选仍存**，非此次新证实 TS 迁移回退；合法集中 owner 时二次元素比较，wall 旧报告仅局限其版本与样本。 |
| `docs/investigations/decision-investigation-constant-factor-audit.md:47-63,67-78` C1 同字节身份与 YAML 重解析优化方向。 | DR full check；`src/mutations/check/decision/sources.rs:117-158` 分类、摘要前置 parse、正式解析；`src/domains/decision/candidate_header.rs:4-5` → `src/domains/candidate_header.rs:29-30` 是 YAML 事件解析；`src/domains/decision/body.rs:128-136` 让同一正文再次 `parse_frontmatter`，后者 `frontmatter.rs:21-35` YAML 加载。 | **同阶段重复解析仍存／候选**：正常正式记录分类一次、完整 frontmatter 两次；摘要在正式正文无效时亦可能有意义，不能简单删首轮。旧报告为优化方向，尚未逐个对齐迁移前 TS 调用，不能断言次数回退或耗时瓶颈。 |
| `docs/investigations/record-stage-convergence-10k.md:26-52` 固定 K=1、完整工作区与 pending 验证；`261108-record-cli-native-complexity-survey.md:65` 对部分 stage 场景保留待隔离候选。 | 两域 all/domain stage：`src/stage/source_capture.rs:53-72` 对每个 selected path 从 workspace entries 开头找 owner，而 `:174-204` 事先建立跨 snapshot 的 path→owners。 | **仅候选**：K 条选中、N 条 workspace 最坏 K×N；需确认复用映射不会改变快照身份、路径冲突及错误顺序，不主张迁移退化或全阶段复杂度。 |
| `docs/investigations/investigation-local-stage-and-single-read-check.md:39,89-91` IR 只读 check 首次采集一次，其他写路径保留对应 freshness；`record-tools-first-optimization-validation.md:39-47` 旧 DR 复用同轮状态但仍独立复读 revision。 | `src/mutations/check.rs:1-2` 明定 first-observation、无结束 freshness；DR `src/mutations/check/decision.rs:24-34,52-59` 复用状态和 revision；IR `src/mutations/check/investigation.rs:10-20,27-62` 同类。写操作单独执行 `src/mutations/sync/investigation_sync.rs:35-41,66-81`。 | **契约改变不可直接比较**：DR 当前 first-observation 与旧末尾 revision 守卫不等价；不可将所有独立 fresh 读取称冗余，或仅凭更少读取称性能优化。IR 普通源首次采集仍保留，不排除固定历史目标额外读取，已由新报告独立记录。 |
| 同上 IR stage 局部范围契约；`docs/investigations/261028-record-cost-reachability-boundaries.md:46-55` 单纯合并安全 lstat 可能改变瞬时符号链接拒绝。 | `src/mutations/sync/selected_sync/sources.rs:37-50,57-79` 定位选中旧路径并采必要依赖；`src/stage/investigation_scope/discovery.rs:6-15,28-54` 限定 literal pending 候选。 | **局部源码获取保留，但非整项 O(K)**；身份移动、依赖、资源安全及完整图/索引验证有独立责任。不能以 I/O 次数单独断言安全检查冗余。 |

## 审核范围

比较以上历史 261010、261021、261022、261028、261107、261108 报告与列举 HEAD 源码；已知 261110 IR 历史目标批读与资源目录重复枚举不在此复述。未运行测试或时延采样，未完整比对所有异常分支、完整写事务的阶段重采、安全竞态和各平台；仅源码层面不证明运行时耗时及行为等价。仓库原有未提交调查文件未修改。

## 当前代码核对


HEAD 4fdeb558；只读源码。运行 `python3 reallocation_probe.py` 会创建 reallocation-20、reallocation-40；脚本拒绝覆盖既有目录，使用当前 receipt 指定的原生二进制，在私有 fixture 内创建并同步索引。`reallocation-results.json` 保存完整 CLI 输出和模型记录。没有墙钟采样。二进制 SHA 与 receipt 一致。

- DR `sync-index --select <last> --preflight`：`src/mutations/sync/decision_selected_sync.rs:56-84` 反复扫描全部边直到重划闭包不再变化。`src/mutations/sync/selected_sync/sources.rs:46-50` 在 baseline 和 combined 上各运行一次。20/40 个 successor、21/41 个 archived predecessor 的合法二部链，公开 full sync/check 和 selected preflight 成功；checkedIds 精确覆盖 41/81 成员。独立 Python 模型重演扫描得 40/80 趟及 1600/6400 次边检查；数字不是 CLI 插桩。相同代码存在于 a88af9bc 的原生源码，未建立旧 TypeScript 对照，不能称相对于该旧端的回退。
- 两域 `stage --scope all/domain`：`src/stage/source_capture.rs:53-72,116-117` 每个所选路径在 workspace entries 和 pending blob slice 线性查找；最坏 S×N + S×P。入口 `src/stage/decision_scope.rs:38-51,79-104` 和 `src/stage/investigation_scope.rs:40-59,215-250`。来自同一 acquisition phase 的已捕获事实可考虑安全索引；不应去掉验证或合并事务必要的独立观察。尚无动态计数或端到端成本证据，旧版原生同代码。
- IR `stage --scope all/domain`：`src/stage/investigation_scope/resource_selection.rs:28-34,137-152` 对 D 个直接资源用 Vec contains 查 R 个工作树资源，及对 pending、workspace 每条资源扫 S 个 owner 前缀，分别最坏 D×R、(P+R)×S。需保留路径组件、owner 与软链接安全语义。尚无动态计数或端到端成本证据，旧原生也存在相同扫描。
- 另见既有 docs/investigations/_resources/261108-record-cli-native-complexity-survey/graphs/evidence-notes.md 的 IR owner 资源引用线性 contains；不重复声称为新发现。

审查范围：两域 list/search/trace，完整与选定 check/sync 的选择和图，常规 authoring/relations/identity/lifecycle 循环，stage 的来源与 IR 资源选择。没有穷举 Git 进程；完整图有效性、事务不同阶段的 fresh 读取、排序分页及精确范围读取不因耗时被当作冗余。阶段成本/旧 TypeScript 差异及实际用户负载影响未验证。

## 进程边界核对


Revision 4fdeb558, old reference a88af9bc029a1539c3abe57f69d752e4d39a868e. The executable is the prepared receipt generation-jWtx84, not a fresh build. `probe.py`, `summary.json`, and the 12 Git Trace2 files are the reproducible private fixture and raw count evidence; rerunning probe recreates only its own `fixture-decision` and `fixture-investigation`. No wall-clock conclusions.

## Trace counts: real CLI stage --scope all

Each private Git repo has N=32 formal documents, initial committed index, P=34 pending members (32 docs, 1 domain index, 1 unrelated file). All 32 working docs have appended content and workspace index synced; K=1,8,32 selectors. For each invocation the exact initial private pending index is restored; global/system Git config disabled. Each exit 0; selected document bytes equal working files and every unselected document equals its individually captured original pending bytes; the unrelated pending bytes and 32-entry staged index are validated; native and old staged index bytes match at each K. This is the strengthened rerun: the earlier probe only checked unselected bytes differed from working files, which did not establish equality with the original pending bytes. Result output not asserted equivalent. Old runtime uses current resolved dependencies and is not a full historical environment. `tail-identities.json` records post-run native binary hashes, deterministic old script-tree hashes and Node version; these are tail-only fingerprints, not evidence of unchanged artifacts throughout the run, and do not cover all resolved dependencies.

| domain | K | native Git starts | old Git starts |
|---|---:|---:|---:|
| decision | 1 | 23 | 22 |
| decision | 8 | 51 | 29 |
| decision | 32 | 147 | 53 |
| investigation | 1 | 34 | 38 |
| investigation | 8 | 97 | 45 |
| investigation | 32 | 313 | 69 |

Counts include startup events only, not elapsed time or internal Git processes without a Trace2 event. Resources absent: investigation owner scope query still happens. For K=1/8/32 native IR `ls-files` 6/13/37 and `ls-tree` 3/10/34; one of each per extra selected owner. Native decision/IR increases 4/9 starts per extra K; old both increase 1. Both implementations also write K changed blobs and one index projection; a +K object write is not itself a new regression.

## Cost map and prioritization

1. **High, measured stage scaling, prior batch lost.** `src/git/selected.rs:24–56` reads membership once then type, blob and verified hash serially for each selected existing pending path: 1+3K starts per call, plus 2 reader threads per common-adapter invocation. Stage consumers `src/stage/{index_scope/pending.rs:169,decision_scope/discovery.rs:71,investigation_scope/discovery.rs:15,source_capture.rs:156–170}` can read different or overlapping selection sets. Old `tools/shared/src/version-control/git/pending/git-pending-snapshot-content.ts:15–32` deduplicated OIDs and used one bounded `cat-file --batch` (`git-blob-batch.ts:47–50`). Selection, unique supported stage/mode, output bounds, object identity and not opening unselected payloads remain requirements.
2. **High, measured scope-query scaling, prior batch lost.** IR `src/stage/investigation_scope/resource_selection.rs:101–112,28,130–132` forms one owner scope per selected id plus direct paths; current `src/git/workspace.rs:21–35` issues one `ls-files` per scope and `src/git/revision.rs:65–68` issues one `ls-tree` per owner. For O owners and D distinct direct paths, deduplicated nonempty scopes contribute at most O+D ls-files and O ls-tree with committed HEAD, plus fixed discovery/prefix. Old `tools/shared/src/version-control/git/git-pathspec-query.ts:25–80` budgeted literal pathspec batches. Preserve literal semantics, dedup, scope constraints, and symlink boundary validation. Trace fixture had D=0, and still grows by 2 per owner.
3. **Medium, common selected Git writes, partly previously parallel.** `src/git/publish.rs:44–59,134–148,179–199` hashes every changed non-delete file individually and serially, then single update-index; unchanged/deletions do not write blobs. K changes => K hash-object processes, plus one format, update-index, final membership and root checks. Old `tools/shared/src/version-control/git/pending/git-pending.ts:162–235` reused prior entries, grouped equal content and ran up to 4 object writes concurrently, but also used hash-object per unique changed content. Thus not a universal process-count regression; compare wall time and contention before deciding. Keep conflict detection, index lock/partial failure reporting.
4. **Medium, same history batch-loss applies beyond full check but static only.** IR publish `src/mutations/authoring/investigation_publish/history.rs:114–122` loops historical matching targets; each existing `read_revision_file` costs ls-tree + cat-file + hash-object (`src/git/revision.rs:5–20`, `src/git.rs:138–145`). K historical targets adds 3K, plus index read and fixed probes; no new runtime measurement here. IR rename/discard history `src/mutations/identity/investigation/history.rs:13–18,71–92,115–147`, DR lifecycle `src/mutations/decision/history.rs:82–169`, DR rename `src/mutations/identity/decision/{history,pending}.rs` also use history/pending and re-probe but typically individual identities, not proven K fanout. Existing full-check batch regression already measured in long-lived investigation; do not present these single-item operations as measured regressions.
5. **Low, fixed repeated discovery and wrapper overhead.** Resource membership `src/resources/membership.rs:7–21` discovers repo then `src/git/workspace.rs:151–156` discovers it again, plus prefix and one scope query = 4 Git starts in repo, once per ResourceContext capture, not per resource (`src/resources.rs:49–64`, `src/resources/issues.rs:28–34`). `probe_head` itself rediscovers then resolves HEAD (`src/git.rs:190–197`); pre/post capture HEAD and pending checks in identity flows guard races, not automatically redundant. Normal repo wrapper `scripts/record-native-cli.ts:14–18` checks `preparedRuntime` then spawns exactly one native child, while `scripts/lib/record-native/runtime.ts` validates directory chain, receipt and hashes selected binary; installed skill invokes binary directly. Fixed overhead, not a K-scale regression.

Production subprocess creation sites in native CLI: common Git `src/git/command.rs:10–24`; worktree discovery `src/git/workspace.rs:90–97`; unborn-branch existence `src/git.rs:238–247`. The `Command::new` occurrences in history tests are test-only. No non-Git production subprocess in `tools/record-cli/src`. Common adapter's two reader threads (`command.rs:34–50`) safely drain stdout/stderr while feeding stdin, with bounded retention; not safe to remove without equivalent deadlock/overflow handling. Node wrapper adds one native process for repository short command only.

## 独立审核与主代理核对

- 初始 probe 的未选正文断言仅证明不等于工作区；已加强为逐字等于原 pending 并重跑 12 场景，计数不变。独立审查代理定向复核确认缺口闭合。
- scope 数收紧为去重后的非空 scope 数，至多 O+D；正文与本提炼版本采用收紧表述。
- 名称查找仅限定非日期名称解析环节；闭包次数仅为外部模型；YAML 与路径乘积仅列候选；必要 fresh 和已修复 heap 不误报。
- 主代理独立重算 12 份 Trace2 总数，核对同档两版 staged index 摘要相同，并核对重划 CLI 成功与模型记录。
- 辅助脚本保留当次目录假设，含对自建私有 fixture 的重建／复位，不是可直接在真实记录上运行的维护入口。源码与 fixture 未作为新增稳定测试维护。

## DR YAML 定向补核

独立审查后升级为“旧同轮 frontmatter 复用机制未保持”：旧 scan-snapshot.ts:123–137,164–183 的同一 sourceFiles 经成员检查和正式扫描，scan-collection.ts:138–145 保存 DecisionMarkdownSource，scan-records.ts:82–90、record.ts:80–89 复用对象；decision-metadata.ts:48–52,58–83 构造时解析一次并由 identity/parse 复用。现版 sources.rs:126,155,158、body.rs:128–136 对同一次采集做分类事件和两次完整解析。只证明正常正式记录 full check 的复用机制变化，不证明 parser 等价工作、耗时或错误语义等价，不能直接删除摘要解析。
