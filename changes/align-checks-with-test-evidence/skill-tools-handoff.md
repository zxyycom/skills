# E 切面：Skill 工具测试整改交接

## 范围与状态

- 只写四域 tests 及本交接；未写产品 src、分发 skills、长期文档、Case/index、package 或 checks/run。checks/run 的新 leaf 接入已由 Gate owner 完成。无 commit/push，无工具依赖安装，无 manual SSH/MCP 或真实业务请求。
- 初审与最终复核列出的八项已整改；并采纳 parent-move 同阶段确定性、删除后真实当前集合、配置 timeout 独立值、stats 过强名称和局部进程清理这几项邻近改进。其余按既有证据保留，不把每个可加强点新增成节点。
- 纯测试内容不需要 skill version／生成物变化。全部原生意图保留；LJ 三节点迁移、四节点改名，不新增原生节点。MCPShell manual localhost 仅适配显式 git fixture 参数，未运行。

## 实现与证明责任

| 对象 | 最终观察与取舍 |
| --- | --- |
| MCPShell put symlink / parent-move | 沿现有 fake SSH PATH→wc seam，在生产 remote script 已 cd 到验证 parent、receive 完成且最终 containment/commit 前同步执行交换或移动；先核 cwd 和 transfer 临时文件，再写明确 event。外层核 event、symlink 终态、原目录完整 bytes／外部零 destination；move 还核移出与重建目录皆空及 source 不变。删除两份后台200次静默poll和两份8MiB时间窗口输入，用小辨识payload；无生产hook或随机概率声称。 |
| MCPShell patch | fixture SSH 入口追加独立 calls 文件；正向真实git apply节点核记录健康，两个本地拒绝核文件保持空，直接支持 before SSH。保留真实 Git 正向四种 patch 行为。 |
| MCPShell binary / empty | 独立 node:crypto SHA-256 分别对 binary/empty 两端比较；put/get 均核 bytes；empty 真实读 project 目标与 staging get 输出为空。不再允许 undefined==undefined 通过。 |
| MCPShell initializer | 第一次 apply 后比较完整原 unrelated TOML 前缀（comments/model/other table），第二次仍核幂等；其余indented TOML专门回归不删。createBridgeFixture 默认不建Git；只有真实patch和manual localhost明确 git:true。 |
| LJ disabled images | 所有适配器拥有健康 credential getter（含legacy key），每行独立记录getter与fetch；精确 input/images:true 诊断、credentialReads=0、fetches=0、attempts=0、无DB。名称移除没有直接观察的assets承诺，保留scope/坏URL/dry-run矩阵。 |
| LJ source / distribution | Base64与两项legend源码节点迁入adapter-image-validation.test.ts；原adapter-regressions只保留大PNG真实Node smoke。PNG原fixture构造移至局部adapter-image-fixture.ts供两文件共用，无新的进程框架。Gate已把新leaf接request组和run，public仍消费Node leaf。 |
| LJ child/server | child局部3s deadline及abort失败latch，SIGKILL后等待close再reject；finally仍核kill/await close。server.close同时closeAllConnections，最后删fixture。故障验证确实打开未完成loopback request后挂起，无真实外网。 |
| LJ config / stats | 原config优先级节点新增doctor配置值99，保留CLI100与默认15000；stats节点名称收窄为分组诊断优先于缺库诊断，不声称直接测得零DB open。 |
| Novel BOM | writer第三次抛错前记录failureInjected；外层核命中及count>=3，回滚读完整Buffer（含BOM），成功snapshot仍比完整BOM原文。 |
| Novel ID / index | new-id准确承诺一次可用ID而非普遍唯一性；删除卡后重建读取真实currentSource.records=[]，以该真实集合调用selectCard，不再给selectCard手写[]假称重建证据。 |
| CP baseline / Git env | old distance名称收窄为旧基线不可用不阻断刷新；256KiB伪revision改为正常40hex缺失baseline，去掉argv平台上限依赖。所有共同temp-root callback范围清理继承GIT_*，禁system/global配置、hooks和commit/tag signing，finally恢复；覆盖准备、API、trace及真实Node CLI而非只隔离bootstrap。fixture串行前提沿现有runner，不引入全局并发框架。 |

## 最小原生节点与Case交接

下面新ID按现有 snapshot 的 SHA-256(JSON.stringify([file,name])) 规则计算，仍由整合者以实际snapshot复核。意图连续，保留原Case ID；无待删除Case。

| 旧节点／旧ID | 新节点与新ID |
| --- | --- |
| `tools/lightweight-judgment/tests/adapter-images.test.ts` — image permissions scan every scope and malformed inline nodes refuse before credentials storage assets or HTTP<br>`test:aa38040efdcf5fb437f1dcb704e694fb228c5d51badef83c1c617b87e1e9f5b9` | `tools/lightweight-judgment/tests/adapter-images.test.ts` — image permissions scan every scope and malformed inline nodes refuse before credential access logging or HTTP<br>`test:5d2f18a3c2d73f7c596ba01d1db802340ebacf7e1f62c4619fb5974333cf44d0` |
| `tools/lightweight-judgment/tests/statistics-summary.test.ts` — stats invalid tag grouping diagnoses group by keys before database access<br>`test:a787a2b832cc76131863ee0d031cf880b6cd8a5ee7075a55f7794aaaeb46f5e4` | `tools/lightweight-judgment/tests/statistics-summary.test.ts` — stats invalid tag grouping reports group by keys rather than a missing database<br>`test:456d00a6ad2404bf6886035278246133ab7e4d707a45922bd6b76fd6fe9a3c65` |
| `tools/novel-cards/tests/chapters.test.ts` — renaming and renumbering chapters preserve stable IDs with a usable unique ID generator<br>`test:6800548c6fe106f7b1ac0c120363147f284342e0ec16b184ed77fd4d8756f4d0` | `tools/novel-cards/tests/chapters.test.ts` — renaming and renumbering chapters preserve stable IDs and new-id returns one usable ID<br>`test:c0cb039380e1b5f043252aeba793c03ea7a3ca7426acf5f15dc0eed659b97f30` |
| `tools/change-plan/tests/lifecycle.test.ts` — plan refreshes the baseline without inspecting the old distance<br>`test:f4bdf9830e8c26ffe9e36facce2a31f44b61386ed71a0e08334b70709c206e0c` | `tools/change-plan/tests/lifecycle.test.ts` — plan refreshes the baseline without being blocked by an unusable old distance<br>`test:7a47d133a8d2e5b540c798e40c908a5f9c4a5b025f8ecd553721069c4e197c68` |
| `tools/lightweight-judgment/tests/adapter-regressions.test.ts` — inline Base64 rejects malformed alphabets and padding while canonical variants remain valid<br>`test:0e1deb9d332f9d5e12983188a45ab66014ebbd36124b9b3b7921f4971271b93b` | `tools/lightweight-judgment/tests/adapter-image-validation.test.ts` — inline Base64 rejects malformed alphabets and padding while canonical variants remain valid<br>`test:40493d93c30332a5bb68a64cab89a15740c3df10d5274fb5c36fb62585c6e643` |
| `tools/lightweight-judgment/tests/adapter-regressions.test.ts` — structured Jev legends ignore object member order but retain raw and request order<br>`test:24c24b23d97fb52b14ce264b7465b9c2206ddeee1b0e74ea0573ec065daa0b27` | `tools/lightweight-judgment/tests/adapter-image-validation.test.ts` — structured Jev legends ignore object member order but retain raw and request order<br>`test:fb885b38288d5479721d88c2d50bcc22a6584b372483c43f38cf62613302dc66` |
| `tools/lightweight-judgment/tests/adapter-regressions.test.ts` — structured Jev legends reject reordered arrays changed own keys types and values<br>`test:a47e5cf79d05321c586335162b4f27012dbde415780e2af7d725a7e45a05e82c` | `tools/lightweight-judgment/tests/adapter-image-validation.test.ts` — structured Jev legends reject reordered arrays changed own keys types and values<br>`test:293f37a442537dae50a3d6428b788ed0a3e239030b3056e37bf242c38e6f60b5` |


### Contract / Proves建议

- `mcpshell-bridge-init-002.md`：Contract不变；Proves明确首次完整unrelated片段保留与二次幂等。
- `mcpshell-bridge-patch-001.md` / `002.md`：正向保留真实Git边界；002 Proves新增独立SSH calls文件为空（001正向确认该记录可工作）。
- `mcpshell-bridge-file-001.md`：Proves写明binary/empty真实put/get bytes及独立crypto SHA，不仅端点相等。
- `mcpshell-bridge-file-003.md` / `005.md`：Proves把“temporary出现后”改成“verified cwd＋receive完成后的wc提交前同步事件命中”；003核链接确实换到外部、原parent保存完整payload；005核移动及清理事件。不得声称真实OpenSSH/MCP全部交错。
- `lightweight-judgment-adapter-image-permission.md`：Proves新增健康凭据getter读取0与fetch0、精确input/images诊断；保留坏URL不泄露、无DB与attempts0。删除assets零构造的未经观察承诺（若有）。
- `lightweight-judgment-adapter-standalone-http.md`：原1send/native wire/raw/normalized责任不变；资源清理是fixture可靠性，不新增业务Contract。
- `lightweight-judgment-adapter-canonical-base64-validation.md` / `structured-legend-object-order.md` / `structured-legend-value-mismatch.md`：只迁Tests到新leaf的新ID，Contract/Proves不变，不继续归public-only分发证据。
- `lightweight-judgment-configuration-priority.md`：Proves可精确写config99、CLI100、默认15000独立预期。
- `lightweight-judgment-stats-group-diagnostics.md`：Tests换新ID；Proves明确分组input诊断而非缺库storage诊断，不把结果优先级说成直接open计数。
- `novel-cards-bom-preservation.md`：Proves新增第三writer故障命中及回滚完整BOM bytes；原成功snapshot全文证据保留。
- `novel-cards-chapter-identity.md`：Tests换新ID；Proves只承诺单次new-id合法且可建卡/读取；Contract里的冲突规避为规范要求，不把一次观察说成普遍唯一性证明。
- `novel-cards-stale-index.md`：Proves改为删除后重建的真实集合为空并card-not-found，而非selectCard手工空集。
- `change-plan-lifecycle-refresh-001.md`：Tests换新ID；删除“超长sentinel”和“从不查询旧distance”证明；Proves为40hex但不存在旧baseline的Plan重确认成功，新baseline精确当前HEAD。
- 共享fixture的CP Git隔离不新增业务Case；用下方hostile环境执行证据说明。MCPShell manual-only未新增Gate实体。

## 实际验证与首次失败

环境：`TMPDIR=/var/tmp`、Bun1.4.2、Node24.18.0、`CI=true`；全部离线业务依赖，只有隔离loopback HTTP。

- 首轮七个精确文件：MCPShell initializer/runtime、LJ images/new validation/native HTTP、Novel transactions/chapters，46 pass / 0 fail（2.10s）。
- CP artifact/active-plan + lifecycle-finalize两wrapper：43 pass / 0 fail（3.26s）；此前误省略`./`且混入cli.test的命令实际仅发现6 CLI节点，单独6 pass，不冒称wrapper通过。
- CP hostile Git环境：初次仅隔离withTempRoot，49节点中47 pass / 2 fail，发现withFileSystemRoot内的bare仓库/真实CLI仍污染；隔离下移共同temp-root后同49节点全过（4.45s），hostile hook marker与指定host index均未产生。日志：`.log/vibe-check/e-git-hostile-TiT9yu/{tests,tests-after}.log`。后续40hex输入替换已纳入最终78节点验证。
- LJ故障验证：fake node打开未完成loopback请求并挂起。首次局部deadline10s晚于Bun原5s：runner5s超时、报告kill1dangling并留1 fixture目录；改局部deadline3s（不放宽runner预算）后准确native Decisions child timed out，3.03s结算，child PID1987432已退出，第二次fixture已回收、没有新增目录。日志：`.log/vibe-check/e-lj-child-timeout-GxT7P1/{tests,tests-after}.log`。首轮目录`tmp/judgment-calls-7GrlbE`保留故障现场，不误称全部无残留。
- LJ native/新leaf/images/preflight/stats/large PNG + MCPShell生成：22 pass / 0 fail（2.60s），含真实Node大型PNG与5个MCPShell生成节点。
- MCPShell同步swap/move两节点五轮：每轮2 pass / 0 fail，合计10次命中；其余6节点明确filtered。只说明这五轮确定性受控交错，不推断任意竞态概率。
- Novel完整wrapper：36 pass / 1 fail（45.71s）；未改的10000卡既有30s timeout，在同时D整包验证时超时。没有降生产上限或放宽预算。D窗口释放后复跑37/37通过（23.92s），10000卡节点16.81s；该次仍从ps观察到他会话DR runner100%CPU，故不称完全无竞争；先前失败仍保留。
- 最终LJ request-and-response wrapper：68 pass / 0 fail（3.67s），三项迁移源码节点实际注册；含原有active WAL snapshot及迁移SQL责任，没有启动journal-process重型争用矩阵。
- 最终CP49＋MCPShell initializer11/runtime18：78 pass / 0 fail（5.68s），覆盖正常40hex旧baseline、新SSH正向记录健康断言以及全部MCPShell同步交错。
- 最终限定19个本owner文件type-aware Oxlint：exit0；同19文件oxfmt --check通过；git diff --check本owner范围无错误。

## 待整合／未验证边界

- 本owner最后目标复跑与限定质量检查已完成；不再持有重型验证窗口，所有执行进程已收束。
- LJ journal-process争用/锁/SIGKILL、CP安装兼容测试及全Gate没有由本代理启动；其原有测试未删除、未改变，由整合者执行所需release/changed责任。未运行真实manual SSH/MCP、Windows或远端CI。
- Case、索引、实际snapshot、完整check:changed及release交整合者；不能以本文件代替其通过。
- 两个`.log/vibe-check/e-*`目录是本轮有意保留的短期故障证据，根目录附artifact-note；整合者复核后按允许的精确清理方式删除，无长期文档引用义务。shell最初带`rm -rf`的trap组合被工具策略在启动前拒绝，故后续验证省略该清理动作并保留现场，没有改写删除来规避策略。
