---
title: "调查单次采集检查与局部暂存职责复查"
id: "261010-investigation-local-stage-and-single-read-check"
formedAt: "2026-10-10T10:00:44Z"
question: "全量只读检查采用首次对象、局部暂存预选必要依赖后，固定选择增大全集时访问是否仍局部且写入保护保留？"
tags:
  - "performance"
  - "root-cause-analysis"
  - "skill-tooling"
relations:
  - type: "复查"
    target: "261010-investigation-acquisition-performance-recheck"
    summary: "改变检查与暂存责任后复测固定选择及全局残余成本"
---

## 形成时背景

前序复查在实现职责收敛后仍测得 N=K=20 的 domain stage 集合内 readFile 102 次、Git 24／26 次，全量 check 41 次。用户进一步确定结果责任：只读 check 只验证首次采集的同一份对象，不承诺结束时来源仍未变化；stage 不再以全集原文健康为局部门禁。本轮基线为已提交 `10442106`；前两报告及其原始资源保持不变。

## 调查目的

区分访问降低来自职责变化还是隐藏缓存，检验固定 K=1 增大全集 N 时正常 stage 的原文与资源访问是否局部；同时证明所选来源、直接资源 owner 与写前漂移仍拒绝非法写入，并诚实列出完整 metadata 和 pending 的剩余成本。

## 调查范围与依据

- 2026-10-10，Node 26.8.2、Bun 1.4.2、Git 2.53.0、Python 3.14.7。`before` 为 HEAD `10442106f209321457ad22066af5b379606a7b5d` 的生成 CLI，SHA-256 `f4cb1f7d4079aa371d53241ded88bf11e92b23b88e614d1656f08acecef8e177`；`after` 为该基线上的首次未提交实测实现，SHA-256 `710f8b6f57f12d20aebca96e60dafe2b19aecb0e310361aa89eb9d9c3a934795`。这些指纹只定位当次实测，不表示已经提交或发布。
- [隔离重放脚本](./_resources/261010-investigation-local-stage-and-single-read-check/measure-local-acquisition.py)复用前序 fixture，运行 N=1／20／100、固定 K=1，以及 N=K=1／20。有资源样本每报告一个普通资源、所有资源字节相同；formal 已同步并在隔离 repo 提交，pending 起初等于 HEAD，普通样本无关系。init/add/commit/stage 只在自动清理的隔离 repo；主仓库未暂存或提交。
- 每阶段各 26 次命令，增加无资源、fileMode true/false、无关坏／删除原文、所选坏原文及真正直接共享 owner 依赖样本。所有访问保持原返回值：fs/promises readFile 记录正文、资源、索引和重复路径／源调用位置；Git Trace2 计进程，spawn/execFile 观察器另外计树／pending 条目和 cat-file 输入请求。不是仅用 fs 计数推断没有 HEAD 正文。
- [前后观测](./_resources/261010-investigation-local-stage-and-single-read-check/observations.json)保存实际退出、各类读取、路径重复、来源位置、Git 命令分布及批次条目／blob 请求数；隔离绝对路径归一化，不保存临时 repo。单次耗时不是固定时延或加速比证据。
- 2026-10-10T10:34:33Z 的[路径安全修复后重放](./_resources/261010-investigation-local-stage-and-single-read-check/post-safety-observations.json)定位实际生成 CLI，SHA-256 `f5c1f20cebefadd6e0a8bb0de7357ba246254380890f93ad0dc002cf2eb0e3f8`；2026-10-10T10:38:28Z 的[未引用文件名兼容性收敛后重放](./_resources/261010-investigation-local-stage-and-single-read-check/final-safety-observations.json)定位路径安全修复阶段的冻结对象，SHA-256 `e23aacfba870dddf586059a553249ca7b935a78b45c1455e8840e7bb1ef9ca88`。原 after 对象及指纹不被覆盖；两个新增 checkpoint 各 26 项退出状态、readFile 次数与路径、Git 分布和成员／blob 请求计数均相同。隔离 Git commit ID 因重建而不同，比对时只归一化该 fixture 身份，不抹除命令、成员与请求差异。
- 2026-10-10T10:54:46Z 的[最终文档与代码优化后重放](./_resources/261010-investigation-local-stage-and-single-read-check/final-optimization-observations.json)定位新的生成 CLI，SHA-256 `d63a98dd4ce5bf5a03b7dae2ecd67f77a4da59b1c147187d56a05e212487ca69`。该 checkpoint 的 26 项退出状态、readFile 次数与路径、Git 分布和成员／blob 请求计数与安全修复阶段冻结对象相同；只归一化隔离 fixture 的 commit ID。源码定位与单次耗时仍按此次真实输出保留，未拿它们作等值或墙钟加速证明；前三份观测原样保留。
- 首次实测后的可移植脚本独立重放，26 次计数与重复路径均与 `after` 相同；主仓库 50 份发布报告上 list --limit 1 与 metadata search --limit 1 各实际读取正式正文 0 次（结果保存在新观测，不覆盖历史资源）。
- 独立原生回归与 Case 位于 `tools/investigation-report/tests/{snapshot-check-contract,local-stage-contract,staging-resource-safety}.test.ts`、`docs/test-evidence/cases/investigation-{check,stage,sync}-*.md`；共享显式阶段依据由 `version-control-workspace-phase-basis.md` 承接。既有 legacy constructor、候选读取失败、资源共享、模式／成员／HEAD／pending 等测试继续保留；测试支持选定契约，不证明所有平台或并发时序。

## 调查结果与边界

在本轮隔离样本中，正常已定位 `domain`／`all` 的原文与资源读取随所选报告、直接 owner 依赖及局部资源成员增长，而非报告全集；`index` 零正文，全量只读 `check` 每份正文一次。两阶段来源与路径安全复核、锁内 HEAD／pending CAS 保留。完整 metadata、关系、pending 和其他 CPU 成本仍随集合增长；下列计数不证明整体 stage 为 O(K) 或墙钟加速。

### 固定选择与改变全集

下表为 before → after；正文、资源和索引均为 fs readFile 次数，Git 为进程数。

| 对象 | N=1，K=1 | N=20，K=1 | N=100，K=1 |
| --- | ---: | ---: | ---: |
| domain／all 正文 | 3 → 2 | 22 → 2 | 102 → 2 |
| domain／all 资源 | 2 → 2 | 2 → 2 | 2 → 2 |
| domain／all 索引 | 2 → 2 | 2 → 2 | 2 → 2 |
| domain／all Git（true） | 24 → 21 | 24 → 21 | 24 → 21 |
| index 正文 | 1 → 0 | 20 → 0 | 100 → 0 |
| index 索引／Git | 2／11 → 1／9 | 2／11 → 1／9 | 2／11 → 1／9 |
| 全量 check 正文 | 2 → 1 | 40 → 20 | 200 → 100 |
| 全量 check 索引／Git | 1／2 → 1／2 | 1／2 → 1／2 | 1／2 → 1／2 |

无资源固定 K=1 的正文同样各为 2，索引 2、Git 21；带资源 false 在 N=1／20 均为正文 2、资源 2、索引 2、Git 21。没有为减少进程统一关闭其他 caller 的新鲜度。

对照前序 N=K=1／20，domain 正文分别 3／60 → 2／40，资源 2／40 保持不变，索引均 2；集合内总 readFile 7／102 → 6／82。true Git 24 → 21，false Git 26 → 21。这不是全 stage 常数成本承诺，而是这些批次调用的进程计数。

### 必要依赖与拒绝边界

N=20、K=1 加入另一个正式 owner 的直接共享资源后，after 正文为 4、资源为 4、索引为 2，分别是两个报告与两个资源准备／复核各一次；Git 25（该样本实际写入，多出 hash-object、update-index 与读回）。before 为正文 22、资源 2、索引 2、Git 30。after 增加了真实必要共享资源的字节验证，而非为了数字减少故意漏读。

无关坏正文或已删除正文：before 失败且读 20／19 份正文；after 成功且仍只读所选正文 2 次。所选坏正文：两者失败，after 正文／资源／索引各 1；必要 owner 坏正文：两者失败，after 正文 2、资源 2、索引 1，只经历准备阶段。独立回归另验证必要 owner 正文或共享资源在准备后改变时写前确实重读并拒绝，未选依赖不自动入写入目标。

index scope 零正文不意味着忽略约束：完整发布关系图及 owner 声明非法、最终选择性投影关系不闭合都失败。domain/all 的发布索引写前变化也失败。全量 check 对 revision 相同但完整投影被伪造的索引仍失败；首次采集后正文改变不触发结束重读，下一次 check 才发现变化。sync-index 的必要结束复核仍拒绝同样来源漂移并保留旧索引。

### 所选完整资源树路径安全复核

独立正确性审核发现局部写入范围与校验范围不一致：写入包括所选 owner 的完整工作区／HEAD 成员并集，而资源校验只检查正文直接引用，零引用时直接跳过资源根。共享批量文件读取只检查末端 lstat，祖先符号链接可以指向调查根外普通文件；因此报告没有资源引用但 HEAD 跟踪未引用资源时，替换 `_resources` 根或所选 owner 为外部目录符号链接仍能把外部字节写入 pending。安全门禁缺口属于 domain 的完整所选树责任，不是恢复全 raw 集合校验的理由。

新增 15 个可独立选择的原生回归在修复前为 9 通过／6 失败，失败分别覆盖根／owner 初始替换、相同字节两阶段替换、无 HEAD 成员的空根／owner；该反例不依靠字节漂移来触发拒绝。修复将 owner 树的可缺失路径检查与直接引用的必存在检查分开：准备与写前分别验证资源根、所选 owner、所有将写入成员的完整分量与普通文件身份，在资源字节采集之前拒绝不安全路径。目录／文件缺失可表示未引用基线资源删除；无关 owner 树不被遍历，直接依赖仍严格验证存在和可见性。

修复后原 15 项均通过：初始根、owner、中间目录与末端符号链接均拒绝且不读取替换目标字节；两阶段之间相同字节的四种替换返回 source-drift，原始 Git index 字节不变。根、owner、中间目录或文件合法缺失各成功暂存删除；无引用且无 HEAD 成员的空根／owner 链接仍拒绝；无关 owner 符号链接不阻断所选普通资源变动，也不 lstat 该 owner 或 readdir 其外部树。自审进一步收敛未引用成员的文件名边界：它们按安全普通文件路径处理，不把仅约束直接引用的资源 ID 字符规则扩张为完整树门禁；新增含空格普通未引用文件能更新和删除的独立回归后共 16／0。完整 IR 259／0、共享 version-control 41／0、index-runtime 59／0；项目快照登记 1124 个实际最小入口，新增 16 项由六个 Case 承接。这些是实际隔离环境证据，不证明路径验证与后续文件读取之间不存在任意文件系统竞态，也不把两阶段协议称为原子文件系统快照。

路径安全修复后的两次重放维持上述访问计数，但增加所选资源路径的 lstat、readdir、realpath 与只读 open 等安全检查。这些元数据／身份操作不在原 readFile 计数内，因此计数一致不等于总文件系统工作量不变，也未据此宣称墙钟加速。

### HEAD／pending 与阶段分解

正常 domain/all 的 Git 分布从 rev-parse 9、ls-tree 4、cat-file 4、ls-files 5、config 2，变为 rev-parse 7、ls-tree 2、cat-file 4、ls-files 5、config 2、diff 1。false 原先多出的两个局部 pending 表示读取消失：准备、复核各复用本阶段完整 pending 依据；默认共享 caller 仍取得新依据。

- 固定 HEAD 的索引读取与所选 owner 资源成员只取得一次：树查询返回索引 1 条与所选 owner 资源 1 条。before 另有整个 HEAD scope 的 2N+1 条，以及重复所选 owner 查询。after 不再为 preservedPendingPaths 读取全集 HEAD 正文。
- N=20 的 cat-file 请求序列 before 是 1、22、22、22：HEAD 索引、准备 pending、全集 HEAD、锁内 pending。after 仍是 1、22、22、22，但后面三次分别为准备、写前复核及锁内完整 pending。N=100 对应 1、102、102、102。资源同字节去重成一个 blob，因此 N+2 并非 pending 文件数 2N+1。
- 因新增明确写前阶段依据，全集 HEAD blob 被移除并不代表全部 Git blob 请求总数降低：当前样本总数相同。完整 pending 成本仍随集合／其现有 pending 内容增长，不能被“fs 正文固定 2 次”掩盖。
- 准备与复核各重新取得所选报告、必要 owner、直接资源、完整所选 owner 树、workspace 成员、字节、表示和发布索引。锁内仍核对当前 HEAD 指针及完整 pending CAS；固定 HEAD 事实复用不替代可变复核。

### 根因与责任闭合

原 stageFreshnessFailure 先收集整个原文集合并丢弃结果，后续再读取所选源；full check 在完整对象采集后调用通用 fresh 同步核对导致结束全集重读。现在 readonly check 只比较首次对象的完整投影，IR sync-index／publish 及其他共享 caller 的默认契约不变。stage 先严格解析 metadata 并确定所选和直接 owner 依赖，再按阶段传递已读字节、解析、成员与 pending 表示依据。

正常已定位来源访问随显式所选报告、必要直接 owner 依赖和局部资源成员增长；完整索引、关系、全 pending、排序与其他 CPU 仍非局部成本，未证明严格线性或固定时延。基线-only 删除为证明 ID 没有移动／重现可扩大身份发现；该例外不冒充普通 K=1 样本。没有全局缓存、watcher、守护进程或新依赖，未优化 Decision 暂存的既有扫描。

## 随附资源

- [最终文档与代码优化后重放](./_resources/261010-investigation-local-stage-and-single-read-check/final-optimization-observations.json)
- [未引用文件名兼容性收敛后重放](./_resources/261010-investigation-local-stage-and-single-read-check/final-safety-observations.json)
- [隔离重放脚本](./_resources/261010-investigation-local-stage-and-single-read-check/measure-local-acquisition.py)
- [前后分解观测](./_resources/261010-investigation-local-stage-and-single-read-check/observations.json)
- [路径安全修复后重放](./_resources/261010-investigation-local-stage-and-single-read-check/post-safety-observations.json)
