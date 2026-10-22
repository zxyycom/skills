---
title: "阶段目录事实与完整流式内容校验的成本收敛"
id: "261010-investigation-phase-facts-and-streamed-content"
formedAt: "2026-10-10T18:04:45Z"
question: "如何消除目录重复枚举与全范围内容复制而保留安全及失败语义？"
tags:
  - "investigation-report"
  - "performance"
  - "version-control"
relations:
  - type: "复查"
    target: "261010-investigation-local-stage-and-single-read-check"
    summary: "复查局部获取后残余的目录枚举与全范围复制成本。"
---

## 形成时背景

前轮已把 readonly 全量 check 收敛为首次完整对象验证，并把 domain stage 来源获取限定到所选及直接 owner 依赖。本轮在其已提交基线 `40ee8f0d9caab5cb02695deb2fe60300ce06a704` 上复查新的成本条件：固定 K=1 增加平坦资源 R、根 owner D、完整 pending 条目 P、未选独特大 payload，以及直接关系 E。前轮报告及资源保留其原条件与观测，本报告承接新条件下的独立证据。

局部获取并不等于局部总成本。逐资源逐 component 的目录枚举在完整所选 owner 树上放大；全 pending 多阶段 materialize 与比较复制大未选内容；有关系时历史检查保存并解码全部 HEAD 正文。此外，写前读取故障被压成普通 source-drift 字符串，操作者失去权限、工具和操作目标事实。问题跨资源安全、共享版本管理、历史警告及 CLI 恢复边界，需要分别证明优化没有弱化这些责任。

## 调查目的

消除同阶段重复目录枚举和不必要的全范围内容保留、按路径复制、正文解码，同时保留完整 pending CAS、对象真实读取失败、HEAD source-presence 警告、所选树路径安全和现有默认消费者。区分能减少的成本与必要的全集 metadata/graph、真实 payload I/O、物理事务复制和条件 fallback；不以单次墙钟变化断言普遍加速。

## 调查范围与依据

### 成本变量与责任

N 为正式报告数，K 为选中报告数，R 为所选平坦资源数，D 为 fixture 新增根 owner 数，E 为直接关系数。P 为调查 scope 的全部 pending 条目数，J 为含范围外状态的完整物理 index 条目数；P 与 J 不只代表已暂存变化。下述变量只描述本轮 fixture，实际工作区还受目录深度、共享资源与条件 fallback 影响。

- 资源 owner：`resource-file-validation.ts`、`resource-root.ts` 与新增 `resource-directory-facts.ts`。原路径 lookup 每次 readdir 后 find；R20→R200 时返回项 842→80402，支持平坦树重复枚举的 Θ(R²) 解释。根 D 与 R 联合增加的 RD200 返回 161602 项，根 namespace 被重复扫描。
- 共享版本管理 owner：`git-pending.ts`、`git-pending-replacement.ts`、`git-blob-batch.ts` 与字节比较。原完整 scope 包括干净、未选条目；准备、复核、锁内及写后真实 payload 读取都不能缩成 selected 或 staged changes。B20-large 的比较、normalization、create entries 调用点累计复制 228854318 字节，不只是一次 readFile 成本。
- 历史 owner：`validation-history.ts`。原身份解析只消费 normalized Markdown 前三行或合法直属 basename，却复制完整历史正文。E1N100 实际历史 payload 51753695 字节，原显式复制同为 51753695 字节。HEAD 索引不能证明 legacy、移动或索引不一致来源不存在，也不能证明其他 formal 对象可读；本轮不采用未经证明的 indexed fastpath。
- 失败与流程 owner：`staging-domain-writes.ts`、`staging-domain.ts` 和 CLI stage 诊断。写前错误必须在净化边界保留可靠 category、operation、target，不把读取故障伪装成 mutation。

[对象读取反例脚本](./_resources/261010-investigation-phase-facts-and-streamed-content/object-integrity.py) 与[真实观察](./_resources/261010-investigation-phase-facts-and-streamed-content/object-equivalence.json)在私有临时仓库构造 600000 字节 blob，截断压缩尾部 12 字节：batch-check exit 0、输出 53 字节；实际 batch exit 128、输出 589877 字节。因此 metadata-only 不是旧 full-read 失败语义的等价替代。被拒绝的是静默绕过实际读取，并非建立新的“所有未选对象永远健康”领域承诺。

### 隔离测量与复核入口

所有 init/add/commit/stage 只发生在脚本自行创建并清理的临时仓库；测量不修改主工作区 pending。[测量脚本](./_resources/261010-investigation-phase-facts-and-streamed-content/measure.py)、[计数观察器](./_resources/261010-investigation-phase-facts-and-streamed-content/counter.mjs)、[CPU profile 归属提取](./_resources/261010-investigation-phase-facts-and-streamed-content/profile-summary.mjs)及两侧[before](./_resources/261010-investigation-phase-facts-and-streamed-content/before.json)/[after](./_resources/261010-investigation-phase-facts-and-streamed-content/after.json)共同保存可复核条件。

- before 是从上述固定 HEAD 导出的原生成 CLI 与同版 map，不是重写后的源码近似。SHA256 `d63a98dd4ce5bf5a03b7dae2ecd67f77a4da59b1c147187d56a05e212487ca69`；after 是实际最终生成 CLI，SHA256 `6dc9a8131babe618429b02c36277e38b21576b1c3ff3dfadb85ebf5fe87a1248`。
- 环境：v26.8.2，git version 2.53.0。before 观测完成时点 `2026-10-10T18:16:44Z`，after `2026-10-10T19:44:54Z`。每条件一个带观察器与 V8 CPU profile 的样本；不是独占机器的统计基准。
- P1/P20/P100 对应 N=1/20/100，实际 scope 条目 P=3/22/102，包括索引和资源，不只已暂存变化。K 始终 1。B20-large 使用 20 份报告、20 owner、524288 字节的未选独特正文与 unique 资源；flat 资源含独特前缀，避免多个路径共享同 bytes 掩盖 payload/复制增长。
- R20/R200 固定 N=1、D=0；D20/D200 固定所选 flat R=1、N=D；RD200 同时 R=D=N=200。E1N100 为一条关系和 N=100 大正文；E20/E100 的 E=19/99。关系样本运行全量 check，其工作区完整来源读取责任不变。
- 普通 stage 样本真实修改一个所选资源；U3 修改三个。Git 进程为 25／27，hash-object 1／3；关系 check 为 9。这是观测，不是通用常数上界。
- JSON 保存每 Git batch 的实际 payload、framing（headerBytes 含末端 LF）、输出 bytes、请求数和 unique OID 数；保存 fs readFile bytes（含物理 index 读取，非完整内核/Git内部I/O）、目录调用/返回项、显式 typed-array 复制调用点、保留 Buffer 分配调用点、Node CPU/RSS 及 V8 module self/inclusive 采样。比较视图不是复制；必要 boundary-owned bytes 仍复制。

从仓库运行 measure.py，显式传入欲复核的 CLI 和输出位置即可重建 fixture。要复核 before，先从固定 commit 导出 `skills/investigation-report/scripts/check-investigations.mjs` 与同名 `.map` 到独立目录；map 必须与生成 CLI 的 sourceMappingURL 匹配。传入 `--profiles <directory>` 后，以 profile-summary.mjs 的四个参数（CLI、profile directory、观测 JSON、输出 JSON）恢复模块采样。原始 profile 不作为长期资源；保存的模块采样足以区分 source/metadata/graph 与共享边界，inclusive 时间不能相加或当成精确 metadata 专属 CPU。

## 调查结果与边界

### 因果闭合与实际改动

#### A：同阶段目录事实

逐路径重复枚举同目录是 flat R 条件返回项平方增长的原因。每 phase 现在建立目录名字索引，使用时仍 fresh 检查 dev/ino、类型和 canonical；同身份 namespace metadata 变化时重新枚举，核对已相关的 exact、casefold 与缺失匹配。所选树成员受两阶段保护，无关 owner 或直接依赖 sibling 活动不成为新门禁。

空 owner、合法删除、含空格的未引用名字及文件 opened/canonical identity 保护均保留。资源归属由首段与 selected Set 判断，避免逐文件扫描 ownerScopes。该观察策略不承诺 atomic FS。

#### B：完整 pending 身份与所选内容

多阶段 materialize 和 byte comparison 的全范围复制不是完整 CAS 所必需。共享 opaque snapshot（不透明身份凭据）绑定同一 repository 实例与 scope，保存完整成员、表示和实际 payload 指纹。每阶段仍完整流式验证全部对象，仅保留消费的内容；锁内先核对完整 entries，再验证实际 bytes，写后验证更新与保留内容，显式 patch 保护未选条目及范围外。

同 OID 下实际 payload 改变仍可检测。边界取得自有目标字节，changedPaths 与实际写入使用同一目标，caller 在 await 期间改动原 buffer 不影响该一致性。通用 full-read/replacement 的默认契约及 stdout、stderr 完整预算保留。

#### C：历史身份前缀

历史身份只需要 normalized Markdown 前三物理行或合法直属 basename。专用 prefix 原语校验完整 payload，仅保留有限前缀；前三行不足时以固定 revision 单文件 full-read fallback。LF、CRLF、孤立 CR、UTF-8 截断、EOF，以及 legacy、移动、索引缺失／损坏／不一致条件的 source-presence 和不可用警告均保留。E=0 跳过 Git；E>0 仍验证 HEAD 全部直属 formal payload。

#### D：读取故障与诊断恢复

readonly request、fresh phase facts、prepared writes 与判别 verification 结果显式承接阶段责任。写前读取失败保留净化 category、operation、实际 target；CLI 据此给出权限、工具、并发等待、pending 对账或来源修正动作，source-drift 外层状态不吞掉底层事实，读取失败不附会 mutation。

资源 readdir EACCES 曾在详细检查转为 issues 字符串时丢失系统事实，独立复现闭合了该原因。资源文件系统边界现在同时保留原 issues 与真实 failure；root 检查／解析、owner／intermediate 枚举、文件检查与 terminal open 已由独立回归验证。默认候选和查询仍消费原 issues；普通 symlink、case 与成员问题没有系统类别，无法分类的真实 syscall 则保留 unknown、实际操作／目标和针对读取的恢复动作。

稳定责任分别由[共享版本管理契约](../../tools/shared/version-control.md)、[IR 固定契约](../../skills/investigation-report/references/investigation-report-contract.md)及[完整验证与选择性保留决策](../decisions/archive/retain-complete-validation-with-selected-content.md)承接。

### 前后实际结果

| 条件 | readdir 调用 before→after | 返回项 before→after | 实际 payload bytes（两侧相同） | 显式 typed-array 复制 bytes before→after |
| --- | --- | --- | --- | --- |
| P1 | 6→4 | 6→4 | 7839 | 19884→361 |
| P20 | 6→4 | 6→4 | 148208 | 384083→361 |
| P100 | 6→4 | 6→4 | 745488 | 1934643→361 |
| U3 | 14→4 | 26→8 | 14109 | 34922→433 |
| B20-large | 10→4 | 128→44 | 82703540 | 228854318→524649 |
| R20 | 82→4 | 842→42 | 86387 | 314439→19998 |
| R200 | 802→4 | 80402→402 | 831267 | 3107739→206218 |
| D20 | 10→4 | 128→44 | 230128 | 613459→1385 |
| D200 | 10→4 | 1208→404 | 2327788 | 6174839→1385 |
| RD200 | 806→4 | 161602→802 | 3151216 | 9262694→207242 |
| E1N100 | 3→3 | 104→104 | 51753695 | 51753695→0 |
| E20 | 3→3 | 24→24 | 26378 | 26378→0 |
| E100 | 3→3 | 104→104 | 137578 | 137578→0 |

两侧 13 条件均成功；每条件实际 payload、fs read bytes 和 Git 进程数相同。flat R20→R200 的 after 返回项 42→402，RD200 返回项从 161602 降为 802，证明同 phase 重复枚举被消除，而不是只统计 readFile 后推断复杂度。

B20-large 中 pending 比较调用点各约 41 MB 的临时复制消失，只留下目标 normalization 的 3 次、524649 字节 boundary copy；stream reader 实测累计保留分配 3680000 字节。E1N100 的 history typed-array copy 为 0；100 个 HEAD prefix 累计保留分配 1622344 字节。分配累计不是同时驻留量，计数也不覆盖 Node 内部、stdout transport 或 chunk.copy 的所有复制；不得把它称为总复制或内存上界。

| 条件 | Node maxRSS KiB before→after | Node CPU μs before→after |
| --- | --- | --- |
| B20-large | 354004→193032 | 868348→524449 |
| R200 | 140968→138592 | 1261957→1203764 |
| RD200 | 169484→141728 | 1583620→1333206 |
| E1N100 | 469212→368272 | 1232073→873699 |
| E100 | 110904→113028 | 306026→297560 |

本次大 payload 样本的 Node 峰值 RSS 与 CPU 降低，但每条件仅一个非独占、带观察器的样本，不足以建立稳定性能改善或通用上界。fresh identity/syscall、SHA256、观察器栈采集与必要 metadata/graph 均仍有成本。这里只交付枚举及保留/显式复制机制和样本观测，不宣称普遍墙钟/CPU 加速。Node CPU/RSS 不含 Git 子进程；V8 采样非精确分段计时。

### 验证、兼容与剩余成本

- 独立回归：IR 295、共享 VC 60、index-runtime 59；Case 账本覆盖 1179 个最小原生入口。保留原 IR259、VC41 入口与既有局部/默认消费者边界，新增 same-phase symlink 与同字节普通 root/owner/intermediate/file 身份替换、相关 absent/casefold 与无关 namespace、sentinels、staged 删除、HEAD/pending/mode 漂移、unmerged-before-objects、missing/type/corrupt/同OID实际字节、boundary-owned目标及changedPaths一致性、读回恢复/隐私/CLI 动作、历史 prefix/fallback 与默认 full-read 失败。
- 测试与生成通过仓库公开入口执行；MJS/maps 从源码同步，未手改产物，未改变质量配置或豁免。各受影响消费者相对 HEAD 的独立版本为 IR62、DR72、Change35、Task24、TestEvidence34、Novel4。本次领域同步只更新报告、决策和 Case 的派生索引，没有修改主工作区 pending 或执行 commit、push、release。
- 源码、生成与行为 owner 收敛后的 `bun run check`：65 passed、0 failed、0 unavailable，3 项 release-only 未执行；此次未复用日常 receipt，质量配置与豁免不变。
- 全索引及 metadata/graph、全 P 成员和所有 unique payload 验证、J 物理 index 复制仍必要；本轮性能 fixture 的 pending 条目全部位于调查 scope（J=P），范围外保留由独立 sentinel 回归证明，并未测大型范围外 index 或其扩展的复制成本；不同更新目标的 hash-object 随目标数增长。完整 pending payload I/O 没有变成 O(K)。HEAD-only 所选删除在需要排除移动或重新出现的身份时仍会扩大身份发现范围，该条件 fallback 不属于普通 K=1 样本。history 有关系时仍验证全部直属 formal payload，极长前三行有额外单文件 full-read fallback；全量 workspace source bytes 仍全部取得一次。
- 不保证任意 TOCTOU 下的 atomic FS、不新增对象 hash/fsck 健康承诺、不证明跨调用来源新鲜度或结束时 freshness。外部仓库、不同 Git/platform 的广泛性能与峰值上界未测；重新调查条件是降低真实 payload 验证、扩大缓存生命周期或变更警告/恢复语义。

## 随附资源

- [after.json](./_resources/261010-investigation-phase-facts-and-streamed-content/after.json)
- [before.json](./_resources/261010-investigation-phase-facts-and-streamed-content/before.json)
- [counter.mjs](./_resources/261010-investigation-phase-facts-and-streamed-content/counter.mjs)
- [measure.py](./_resources/261010-investigation-phase-facts-and-streamed-content/measure.py)
- [object-equivalence.json](./_resources/261010-investigation-phase-facts-and-streamed-content/object-equivalence.json)
- [object-integrity.py](./_resources/261010-investigation-phase-facts-and-streamed-content/object-integrity.py)
- [profile-summary.mjs](./_resources/261010-investigation-phase-facts-and-streamed-content/profile-summary.mjs)
