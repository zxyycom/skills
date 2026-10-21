# 十万条规模调查：固定源码静态依据与计时解释

## 范围与证据强度

- 被检查源码：`5c95358bfd42d8da33d056500c707fc6d5e8069a` 的隔离副本。下列 `tools/...:行号` 均相对该 commit 的仓库根目录，不表示未来版本仍保持同一行号。
- 本文是本轮调查资源，不是维护规则、优化实施方案或容量承诺。先读取两域维护 README、相关操作契约及完整编码规范，再检查实现。固定副本未建立 CodeGraph 索引；工具明确返回不可查询后，使用带路径过滤的源码读取。
- “源码事实”指本次直接读取的控制流、集合操作和预算。“静态推断”只说明其在给定数据形态下的工作量，不用复杂度符号代替实测时延、内存或实际瓶颈占比。
- 工作量至少区分记录数 V、关系边 E、索引及正文总字节 B、最大邻接度 D、事件成员数 G、资源数及字节 R、pending 唯一 blob 的完整 payload P。相同 V 的稀疏小组、入星、长链和巨型归并不是等价负载。
- 此轮未修改生产实现。单操作内的关系图已惰性共享；本文不要求再次实现该优化，也不把不同快照或准备/复核阶段的独立图误记为同阶段重复构图。
- 路径缩写：下文只写文件名时，Decision 文件位于 `tools/decision-records/src/`，Investigation 文件位于 `tools/investigation-report/src/`；共享 `graph/...`、`file-text-search/...` 与 `version-control/...` 位于 `tools/shared/src/`。首处完整路径与该规则共同定位固定源码。

## 1. 每次查询的整索引准备

### 源码事实

1. `tools/index-runtime/src/storage-load.ts:48-64,89-113` 的 `loadStateIndexAtResolvedPath` 每次完整读取索引并解码，然后调用 `parseStateIndex`；没有按 selector、limit 或 offset 定位磁盘片段的分支。
2. `tools/index-runtime/src/snapshot-parser.ts:18-75,79-112` 先 `JSON.parse`，校验 envelope，再 clone/freeze；随后 `normalizeStateIndex` 逐条投影并执行 complete validation。
3. `tools/index-runtime/src/projection.ts:21-60,63-112` 每条记录执行 JSON 形状检查、领域 `parseState`、clone/freeze 和 query-field materialization；`tools/index-runtime/src/canonicalization.ts:16-68` 还排序 entries 与 revision 的 ID，并复制/冻结字段。
4. Decision 的 `tools/decision-records/src/decision-index-snapshot.ts:137-174` 在上述加载后，用 `queryStateIndex({query:{limit:1}})` 再执行一轮严格准备，再创建并校验该快照的关系图。`tools/index-runtime/src/query.ts:43-69,211-238` 表明这一调用会再次做 envelope 校验、normalize 和 complete validation；`:154-201` 对全 entries materialize，`:128-145` 在筛选和排序后才 slice。
5. Decision list 在 `tools/decision-records/src/decision-query-list.ts:47-64` 投影全部记录、筛选、排序，构建全集 facets 后才 slice。`decision-query-records.ts:48-89` 还对全部 entries 投影 records，并复制 tags/relations。
6. Investigation list 的 `tools/investigation-report/src/query-index.ts:142-166,205-251` 先构建全集 context/facets，再调用 `queryStateIndex`，因而也在严格加载后再次严格准备。无关系条件的 list/metadata 搜索不访问 `context.graph()`；`relation-context.ts:24-40` 只在首次图访问时构图。
7. Investigation metadata 搜索在 `query-search-metadata.ts:112-135` 排序并检查全部选中 entries、累计所有命中，再按 limit 截断。Decision metadata 搜索在 `decision-query-search-metadata.ts:62-96` 排序并检查全部选中记录，且协议返回全部命中，不存在返回数上限。

### 静态推断与区分条件

- 小 limit、空页或高 offset 限制返回窗口，不消除索引完整读取、解析、归一化、全集 facets 和切片前排序。相关筛选能缩小后续匹配/排序的集合，却不能倒推为省去了前面的严格索引准备。
- 完整准备会多次遍历/分配与 V、E、B 相关的对象；排序引入随记录/边数量变化的比较成本。不能因此直接断言 JSON.parse、freeze、图或 sort 中哪一项在实机占主导。
- 可以用相同输入的读取、裸 JSON.parse、领域 parse/load 与投影微基准区分成本来源，但不同边界的独立测量不可直接相减成为准确阶段百分比。

## 2. 当前来源验证与全量维护

### 源码事实

1. Decision content 的 `decision-query-search-content.ts:170-207` 先加载发布索引，再 `loadCurrentDecisionIndexSnapshot`，再 `syncDecisionIndex(mode:"check")`，成功后才应用查询筛选。失败分支 `:210-258` 完整扫描并验证来源后使用内存投影。
2. Decision `decision-index-source.ts:23-40,44-65,85-119` 的 source revision/snapshot 都先发现并读取全部 Markdown，之后才按传入 ID 选取；即使 caller 提供 IDs，身份发现本身也不是只读这些文件。
3. Investigation content 的 `query-search.ts:52-86` 先 `loadCurrentInvestigationIndex`；`investigation-index-source.ts:43-59,210-220` 的 revision 来自完整 layout/source 读取。`investigation-layout.ts:24-45` 顺序枚举，`investigation-layout-entry.ts:120-137` 完整读正式 Markdown。索引不可用或陈旧时，`query-search.ts:89-123` 先完整验证正式集合与资源，再筛选搜索。
4. Investigation full check/sync 在 `validation-collection.ts:43-89` 取得 layout/source、解析全部 states、校验关系图及资源并构建 snapshot。full check 的 `validation-check-flow.ts:26-61,64-105` 复用这一阶段首次取得的事实。`investigation-state-index.ts:109-130` 显式让 check 的 revision 使用该 snapshot，不能错误声称 full check 必然再次读取全集正文。
5. Investigation selected sync 仍由 `validation-sync-flow.ts:41-80` 先完整采集集合，再在 `:83-101,199-242` 解析 selected scope。Decision selected sync 由 `decision-query-sync.ts:59-76,105-135` 先完整来源验证，再解析选择与同步。
6. 共享同步在 `storage-sync.ts:92-129` 完整 build、重取 revision、比较漂移并序列化；preview 分支在 `:231-243`，发生在这些准备之后。selected sync 在 `selected-sync.ts:47-108` 读取严格 baseline、完整 build candidate 并重取 revision；`:147-169,350-368` 比较全集 ID 的状态 JSON/指纹，拒绝未选变化，实际写入时仍序列化完整 candidate（`:220-223`）。

### 静态推断与区分条件

- 当前来源 content 查询即使最终仅返回几条记录、最终因为候选 cap 失败，也已经承担集合级 currentness 准备。搜索候选/字节预算不能视为前置来源读取预算。
- selected sync 是“只授权接纳所选变化”的完整发布验证，不是“仅解析所选来源”的增量实现。preflight 是零持久写入，不是零准备或低成本保证。
- 来源安全、全集关系/资源检查和写前漂移复核各有契约责任；其全量成本是事实，但单凭存在全量扫描不足以判为缺陷或推出替换架构。

### Decision full check 的额外责任与重复阶段

以下调用数限定为集合稳定、来源合法、发布索引 current、未走错误/候选特殊分支的默认 full check；这是读取控制流得出的静态次数，不是运行期计数或时间分摊：

1. `scan-snapshot.ts:62-78` 先加载完整发布索引、采集来源、生成扫描记录并校验来源图。`scan-index.ts:55-80` 使用 `parseDecisionIndex`，已包含领域严格索引准备和关系校验。
2. `scan-collection.ts:128-145` 的 membership 发现读取每份来源字节，用 `decisionIdFromMarkdown` 解析身份；`scan-records.ts:31-111` 随后复用缓存字节，但再通过 `validateDecisionBody` 解析该 Markdown，执行领域字段、正文与直接目标存在性检查，并核对状态物理目录和索引映射（`:125-175,270-292`）。复用字节不等于复用 YAML 解析结果。
3. `index.ts:89-105` 为新鲜度再调用 `syncDecisionIndex(mode:"check")`；这并不复用扫描得到的状态 snapshot。共享 `storage-sync.ts:92-129` 先 build 完整投影，再重取来源 revision 核对漂移、序列化完整预期索引。
4. 上述 build 的 `decision-index-source.ts:33-40,85-119` 再完整 lstat/read 来源并解析身份；`decision-state-snapshot.ts:39-85,89-125` 对这些来源排序、指纹、批次领域解析并校验独立来源图。`tools/index-runtime/src/snapshot-builder.ts:64-148` 随后逐状态解析、query-field 提取、clone/freeze、全 envelope 校验、canonicalization 和 complete validation。
5. 写前 revision 的 `decision-index-source.ts:23-30` 再完整读取来源与身份，并由 `decision-source-revision.ts:24-59` 排序、核对身份/路径唯一性和计算 SHA-256。最后 `storage-sync.ts:129-177` 序列化完整索引、再读取当前完整索引并做换行归一后的全文比较；current 成功分支无需再次 parse 当前索引。

因此这一健康路径静态上包含每份来源约 **3 次字节读取、5 次 YAML 解析**：扫描身份一次、扫描领域一次、build 身份一次、build 领域一次、revision 身份一次；其中扫描的身份/领域共享一次已读字节。图校验分别属于发布快照、扫描来源和同步投影的独立阶段。源码事实不等于每个阶段实测恰有相同比例的时间。

`validateDecisionBody` 的名称不能解释成“只验证 Markdown 正文”：`record.ts:71-73` 调 `parseDecisionMarkdown`，`decision-metadata.ts:52-64,135-164` 解析并校验 YAML/frontmatter、字段、tags、relations 与 lifecycle，`tools/shared/src/markdown/frontmatter.ts:13-25` 实际调用 `yaml.parse`。正文与直接目标检查只是其职责的一部分。对应内存微基准应称“已读 Markdown 的领域解析/正文与局部关系目标检查”，它没有包含全集对账、重复来源发现/指纹、全局图校验、索引重建和新鲜度复核。

本次合法稀疏 Decision check 链上，已确认的显式超线性集合操作主要是上述全局排序；身份对账、缺失 ID 和直接目标存在性分别使用 Map/Set/Object.hasOwn（`scan-collection.ts:133-172`、`scan-relations.ts:31-64`、`decision-state-snapshot.ts:94-100`、`tools/index-runtime/src/record.ts:18-26`）。固定字段上的 includes 和重复 filter 会增加常数及线性遍历，但不是 V² 的证据。`record.ts:199-202` 对大量同名重复章节逐次展开数组可能随单文档章节数二次增长，不过三节合法样本不会触发；Investigation 的 merge-evidence 二次路径也不在 Decision check 中。

**报告可用表述**：全集 check 的观测时长体现多轮来源发现、YAML/领域解析、指纹、图和严格索引投影/排序及漂移复核的总成本。源码能确认这些职责与重复阶段，不能仅凭独立微基准相加/相减或未经 CPU profile 就把差额归为 I/O、某个 parser 或某个单函数。

## 3. Content 搜索的硬预算与失败顺序

### 源码事实

- 默认共享预算在 `tools/shared/src/file-text-search/request.ts:20-24`：候选 10,000、单文件 2 MiB、总扫描 20 MiB。Decision 沿用该预算，返回预算为 20（`decision-query-search-content.ts:40-46,59-72`）。Investigation 显式候选 2,000、单文件 2 MiB、总扫描 20 MiB，返回预算使用 query limit（`query-search-content.ts:90-115`）。
- 对显式 sourcePaths，`request.ts:113-130` 在开始读搜索文件前按原始数组长度检查候选 cap；超出直接抛资源错误，不是部分成功或候选截断。
- `files.ts:55-74` 对通过预算的全部 sourcePaths 去重排序，并逐一做路径安全验证；随后 `record-search.ts:63-65,77-114` 才逐文件读取/匹配。在第一个无法返回的额外命中处停止，仍计入 matched；无命中时不会因为 maxFiles 提前停止。
- `files.ts:182-219,222-244` 在安全打开后检查单文件与累计字节，超限抛错；读取期间也有字节上限。资源失败不是表示 scanComplete=false 的成功搜索。

### 静态推断与区分条件

- 100k 都被选中时，前置 currentness 之后首先命中候选 cap；不能将其归因为已搜索 20 MiB。Decision 默认 active 过滤后的集合也必须单独数清，不能把全部 V 当选中候选数。
- 收紧 tags/关系条件可使候选数降到 cap 内，但前置整索引/来源准备仍在；即使正文扫描因命中返回预算提前停止，全部候选路径的首次安全验证仍已执行。
- 仅测“每文件开头都命中”的数据，不覆盖零命中、晚命中导致累计字节超限的路径。单文件和总字节 cap 可由静态代码确认；若本轮未做 cap±1/字节边界实测，报告须保留该未覆盖边界。

## 4. 高出度纯归并的关系证据二次路径

### 源码事实

- Investigation `query-search-selection.ts:86-99` 的 type-only 筛选会把命中出边按 source ID 放入同一 bucket。`addRelation` 在 `:161-177` 每追加一条边，先用 `current.some` 线性检查 source/type/target 三元组；`:180-193` 随后排序。
- 合法 Investigation 纯归并允许单 source 至少两个前序（`relation-validation.ts:278-286`），因此可以构造一个 source 拥有 K 条互异归并出边、其余 K 个 roots 无关系的合法样本。
- Decision 对应归一化使用 Map 三元组去重（`decision-query-relation-filter.ts:183-203`），不能把 Investigation 这一具体路径外推到 Decision。

### 静态推断与区分条件

- 上述合法且互异的 K 条边全部落入同一 bucket，每次 some 都不命中，回调次数恰为 `0+1+...+(K-1)=K(K-1)/2`；这是具体条件下可推导的二次比较数，而不是实测时延结论。
- 普通入星中，每个 source 仅一条边，bucket 大小为 1，不触发该放大；仅给一个 anchor 做 related-to 筛选也通常把证据分散到各邻居。E 相同不能替代 bucket 度分布。
- `shape-worker.ts` 的 `investigation-merge-evidence` 在计时外构造并校验图，计时内只执行这一筛选、证据排序与线性计数断言；返回一条 source，断言其完整 K 条证据。它不是完整 list/SDK/CLI 时延。

## 5. 图形、trace 预算与输出体积

### 源码事实

- 共享构图在 `graph/relations.ts:82-98,199-213` 建 ids、全边、正反向邻接。Decision `relation-graph.ts:90-101` 额外先排序全部边；Investigation `relation-context.ts:24-40` 保留投影边序。
- cycle 检查在 `graph/relations.ts:232-280` 使用显式 frames，不递归遍历链；`:276` 排序全 ids，`:284-296` 对每个邻接去重排序。遇回边时 `:265-268` 查找并复制 cycle 路径。
- bounded trace 在 `graph/trace-selection.ts:178-221` 先取得当前节点全部邻居、全部 admission units 并归一化排序，再做 record budget 判断；`:137-175` 的预算 frontier 会收集剩余单位及直接邻居；`:222-228` 保留完整 blockedEvent 成员。
- 当前大事件已有按 query 的 event/unit/member 缓存：Decision `decision-trace-admission.ts:79-108,128-160`，Investigation `relation-validation.ts:52-155`，共享 `trace-ordering.ts:70-124`；`trace-selection.ts:212-217,242-263` 对已接纳成员组复用证明。不应重新使用“每到一个事件成员就重扫完整事件数组”的未核对推断。
- 成功 entry 保留完整直接关系，不仅是切片内部边：Investigation `query-trace.ts:123-137`；Decision `decision-query-record-queries.ts:258-286`。blockedEvent 与 frontier 也没有按 maxRecords 截短成员事实。

### 静态推断与区分条件

- 合法深链没有上述 DFS 递归爆栈依据；大入星仍可能在 maxRecords=50 时构造/排序与大 D 相关的单位及 frontier。maxRecords 限制成员接纳，不保证运行成本和输出 bytes 都以 50 封顶。
- 巨型归并 source 即使事件被预算整体阻断，仍可能在 anchor entry 保留 K 条完整 relations；巨型拆分可在 blockedEvent 保留 G 个成员。低返回记录数不代表小 JSON。
- 合法稀疏图的全图校验包含排序，并非只有一次线性邻接扫描；非法图含大量深回边时，cycle 路径查找/复制还会增加与回边深度累计相关的诊断成本。此异常路径不代表合法深链的实测成本。
- 纯内存 shape trace 计时含 selection、entry 投影、计数断言和 JSON bytes 计算；不含索引加载、Markdown、文件系统或终端 renderer。Decision 用本地 typed wrapper 镜像私有 entry 投影，Investigation 使用导出的 `traceLoadedInvestigation`，两者均须标成微基准而非完整公开 CLI。

## 6. Stage 的局部写入与集合级成本

### 源码事实

- Decision `decision-stage-service.ts:51-81,84-106` 在按 scope 分流前加载严格索引并取得全来源 revision。`decision-stage-target.ts:19-37` 读 baseline 和工作区候选；`decision-stage-sources.ts:25-52` 读取整个正式 HEAD 来源集合，`:76-119` 读取当前全部候选来源，`:148-156` 的所选写前复核再次做当前来源发现。`decision-stage-workspace-scope.ts:127-155` 的 all 重建完整目标索引；domain 不重建该索引但保留上述准备。
- Investigation `staging-domain-context.ts:167-208,222-239` 读完整发布/HEAD 索引并完成完整 metadata 图及资源 owner 校验（`staging-domain-index.ts:26-47`）。all 的目标索引由 baseline 与所选覆盖形成，再完整 build/serialize（`:87-123`）。
- Investigation all/domain 的可变来源准备与复核是两个阶段（`staging-domain.ts:93-157,229-265`）；`staging-domain-writes.ts:100-125,132-169` 每阶段读取完整 pending 身份、取得所选正文/资源及必要 owner 依赖，写入范围仍按选择收敛。不能将其描述为每阶段读取全部无关工作区正文。
- pending 保护在共享 `version-control/pending-snapshot.ts:57-85,181-202,225-264` 对准备、锁内与写后范围作完整 payload 身份验证。`git-pending-snapshot-content.ts:14-28` 按唯一 object ID 选择保留长度，但 `readGitBlobSelections` 仍承担完整 payload 验证；只保留所选字节不等于只读取所选字节。
- `tools/shared/src/version-control/git-blob-batch.ts:4,119-122` 对单次 Git batch 的累计 stdout 设 256 MiB 硬预算；`:154-175` 消费完整 payload 并更新 hash，保留长度不会减少该计数。预算包含 batch framing，不是只计最终保留字节；还有单对象 header/size 校验（`:208-224`）。

### 静态推断与区分条件

- “只选一条”或“只写所选路径”不能外推为常数时间/常数读取。Investigation 的当前正文/资源访问可以随所选与必要依赖增长，同时完整索引、全图和 pending P 仍是集合级因素；Decision stage 当前还有更广的来源读取。
- HEAD/pending 当前且无变化的 stage 能证明该无变化事务路径；不能代替有真实新增/更新/删除目标的写入性能。资源为空的样本不能证明资源密集 owner 树的成本。
- pending/blob batch 的 256 MiB 是字节边界而非记录数边界；小文档的 100k 成功不能外推到同记录数但更大 payload。若未实测这一字节边界，应将其标成静态已确认、边界时延未测。

## 7. 本轮测量解释约束

1. `measurement.ts:8-34` 的 elapsed 包围领域服务/微操作及其中的结果断言，不包含进程启动、静态 imports 和最终 summary stdout 序列化。`collector.ts:30-75` 的 processWall 才覆盖子进程生命周期。主体 worker 调用真实领域服务／查询路径（决策内部查询 handler、调查公开领域函数）；不能把它们称作实际 CLI renderer 全链路时延。
2. `maxRssKiB` 是整个 worker 进程峰值，包含 imports 和计时外输入/预构图；heapBefore/After 未强制 GC，既不是峰值也不是泄漏证明。shape summary 已显式回显这一事实。
3. 当前 collector 每项默认三次，但首样本 wall 超过 20 秒或失败后仅保留一次；超时为 180 秒（`collector.ts:164-203`）。须逐项报告实际 n，保留超时/失败；三次可报中位数及范围，不能称可靠 p95。超时不能当 180 秒成功时延参与平均。
4. 新进程隔离不等于冷文件缓存；前置构造、同步及按固定顺序重复访问会影响 page cache/JIT/GC。环境并非独占硬件与无 swap 保证，不作跨机器容量承诺。
5. Decision 的 `parseDecisionIndex` 包含领域严格准备和完整关系图校验；Investigation 的通用 `parseStateIndex` 不包含同样的领域关系图检查。两域同名“parse/load 微基准”必须按实际边界解释，不作同阶段直接排名。
6. 已 current 的 sync-preflight 不是有变化 candidate 的 preview；只有返回实际 written/staged 的样本证明对应写入路径。完整语义正确性、恢复安全性及未测资源/密度分布也不由性能样本自动证明。
7. shape worker 接入时运行 N=20 smoke、strict tsgo 和 oxfmt 检查以验证方法；规模结论以主线程串行采集的独立结果为准，不引用 smoke 的亚毫秒数为容量证据。
