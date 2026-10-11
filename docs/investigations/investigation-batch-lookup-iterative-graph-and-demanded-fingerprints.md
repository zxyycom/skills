---
title: "批量匹配、深链校验与按需payload指纹"
id: "261011-investigation-batch-lookup-iterative-graph-and-demanded-fingerprints"
formedAt: "2026-10-11T07:19:44Z"
question: "如何消除批量重复扫描与未消费指纹，并在深链中保持关系诊断兼容？"
tags:
  - "investigation-report"
  - "performance"
  - "version-control"
relations:
  - type: "复查"
    target: "261010-investigation-phase-facts-and-streamed-content"
    summary: "复查前轮残余的匹配、关系深链与未消费指纹成本。"
---

## 形成时背景

前轮在保持完整 pending 身份、实际 payload 读取、失败与恢复保护的前提下，减少了阶段目录重复枚举和内容保留/复制。本轮从已提交基线 `0bda55fd78c3fa30223e91460c3b97790cbed7e4` 复查其残余成本：整批 name selector 和未定位 ID 仍各自全扫固定集合；共享关系 DFS 使用递归；普通完整读与历史前缀仍计算最终无人消费的 SHA256。前轮保留其形成时条件与结果；本轮资源用于独立对照上述残余成本。

合法关系链在实际 Node 环境触发调用栈异常，而非领域图错误。问题同时跨共享结构验证、IR/Decision Records 消费者、blob transport 与 opaque snapshot 的实际字节身份，必须独立证明兼容与失败保护；运行时对照及计数证据也有超出最终代码差异和测试的复核价值，因此按项目复杂 Bug 门槛形成独立轮次。

## 调查目的

消除固定集合在整批查询中的重复扫描，以显式 DFS 栈支持合法深链，并取消普通内容读取未消费的指纹。保留 selector 优先级、唯一来源拒绝、图问题顺序及路径、所有 unique 对象的完整实际读取、输出预算与 pending CAS。本轮限定于集合查找、遍历状态与指纹计算，取源阶段、进程调度和写入事务保持原责任；结论以机制、计数和运行时行为为依据。

## 调查范围与依据

### 变量、方法与基线

N 在 selector 测量中是 baseline→workspace 覆盖后的唯一 ID/name 数，在发现测量中是同次 formalSources 数；Kname 是 name selector 数，Ku 是 unique 未定位 ID 数。图用 V 个节点、E 条边，bytes 表示完整实际 payload 长度，retention 只是保留字节数。这些集合成本不等于整个 stage 的 N/P/J、文件系统或 Git 成本。

[测量脚本](./_resources/261011-investigation-batch-lookup-iterative-graph-and-demanded-fingerprints/measure.mjs)从指定 Git revision 或工作树读取真实源码，Bun 仅移除 TypeScript 类型并把不变依赖定位到仓库原路径；discovery 隔离提取原局部纯函数，不重写算法。[before](./_resources/261011-investigation-batch-lookup-iterative-graph-and-demanded-fingerprints/before.json)与[after](./_resources/261011-investigation-batch-lookup-iterative-graph-and-demanded-fingerprints/after.json)保存实际使用的四个源码 SHA256、输入、计数与观察时点。before 完成于 `2026-10-11T07:21:44.422Z`，after 完成于 `2026-10-11T07:39:35.582Z`；生成 IR CLI 的 SHA256 为 before `6dc9a8131babe618429b02c36277e38b21576b1c3ff3dfadb85ebf5fe87a1248`、after `754d6c1f674d9b5117b3e49cda7609d460a01d2a3cd57ffa318981d18ae4777d`。

环境是 Bun 1.4.2 与外部 Node v26.8.2。Bun 的 `process.version` 兼容字符串是 v26.3.0，不代表另一个实际 Node 引擎。Node 子进程在自建、自清临时目录加载真实生产图算法；不是一般 CLI 的深度阈值。脚本不写 Git；复核命令为 `bun <测量脚本路径> <仓库根> <revision|workspace> <新输出JSON>`。其相邻依赖在本轮未修改；独立重放固定基线时需要相应仓库版本与同版运行时。

### 批量匹配

`staging-selectors.ts` 原实现每次 name 查询展开最终 ID Map，`investigation-index-source.ts` 原实现每个 unresolved ID 对同一发现集合 filter。两种纯计算的原观测均随 N×K 增长：

| N | Kname／Ku | 全集访问 before→after | after Map.get 总数 |
| --- | --- | --- | --- |
| 20 | 1 | 20→20 | 21 |
| 20 | 20 | 400→20 | 40 |
| 200 | 1 | 200→200 | 201 |
| 200 | 20 | 4000→200 | 220 |

selector 的访问是原 ID Map iterator yield；discovery 的访问是 formalSources 元素读取，不能把它们当作相同 I/O 指标。after get 总数包含 N 次构建 bucket 与 K 次查询：索引在同次固定集合上只构建一次，查询每项一次 lookup。selector 样本每个 name 唯一，ID Map 与 name Map 总共 2N 次 set；discovery 为 N 次 set。歧义 bucket 的排序及完整诊断输出成本由实现与独立回归承接，不从唯一样本推断所有成本。

### 深链与完整内容指纹

保存的 before 当次观察中，原 Node 图函数在 V=1000/3000、E=V−1 时无问题；V=6000/10000 均出现 `Maximum call stack size exceeded`。同样四组输入在 after 均无问题。相同源码与 Node v26.8.2 的重复运行可在这两个规模通过或溢出，因此它们不是固定复现阈值；溢出规模变化的原因尚未单独证明。原算法在 Bun 的这些条件没有失败，因此不能把错误归因于一般领域规模限制。额外 200 个固定种子、安全深度图覆盖分支、重复、自边、缺失及断开关系，两侧完整 structural issue 数组的 SHA256 均为 `bdf51ea0aeea862918f966bc25c12570f8ee2f8f857a3a9c085a5d752a3be1ac`；原生 fixture 另断言确定性 cycle 条目/路径/顺序，而非只比错误数。

parser 对 1,048,576 bytes payload 的 full／16,384／0 retention，每组均接收 1,048,631 bytes（55 bytes framing）。before 不具备 none 模式，脚本多传的该参数被旧构造器忽略，两组都 hash 完整 payload。after none 模式的 Hash.update 为 0 calls／0 bytes；sha256 仍为 3 calls／1,048,576 bytes，含零字节 update。retained bytes 与所接收 frame 长度两侧相同。这是 parser 的处理计数；真实消费者与腐败失败由下方回归验证，性能外推边界见结果末尾。

## 调查结果与边界

### 根因闭合与实际修复

- **批量索引**：最终 baseline→workspace ID/name 覆盖后，一次构建 name→有序 ID 集合供整批 selector 消费，标准 dated ID 仍优先；同次发现集合一次构建 ID→全部 source 集合，逐 ID 要求恰好一项。索引仅属于本次集合，不跨 fresh phase 缓存或额外读取正文。source fallback 保留原定位读取与发现失败，不把无关 layout.errors 升级为全集健康门禁。消除的是逐查询重复扫描，覆盖、bucket 排序、lookup 与输出成本仍存在。
- **显式 DFS**：共享 owner 使用 `{id, targets, nextTargetIndex}` 帧、visiting/visited 状态和当前路径。父游标先推进再进入子帧；退出同步弹出帧/路径并标记 visited。节点和去重 target 保留 UTF-16 顺序，结构问题分组、循环路径、自边及 dangling 策略不变。深链依赖显式帧而非调用栈；排序、每个循环的 path 查找与输出仍存在，不能据此宣称图整体线性。
- **指纹需求**：普通完整读与 revision prefix 消费无指纹内容；opaque pending snapshot 保留每个 unique 对象的完整实际 SHA256。Reader 在固定模式的结果容器中实际构造相应项，sha256 完成时核对 Hash 并写入必有 fingerprint 的结果，而非用类型声明或 Git OID 替代实际身份。通用 full-read/full-replacement 边界保持不变。

模式、返回类型、完成方法与完整读保护由[共享版本管理 owner](../../tools/shared/version-control.md#blob-指纹模式)完整定义；selector、领域关系和阶段保护继续由[IR 固定契约](../../skills/investigation-report/references/investigation-report-contract.md)及原领域 owner 承接。

### 验证与未覆盖条件

- 原公共入口基线实际执行：shared graph 14、VC 60、IR 295，均零失败。修改后实际公共回归：shared graph 17、VC 66、IR 301、Decision Records 282，均零失败；新增 16 个最小 native 节点，Case 账本完整覆盖 1195 项。原入口全部保留，新增 IR selector 与发现测试按真实 owner 分别进入 pending-stage、collection-and-resources semantic wrapper。
- 实际 Node 子进程 fixture 验证 12000 节点合法链；Bun 执行的 shared、IR／DR 真实领域 consumer 回归分别验证该规模的合法链与晚期环。实际 full read、revision prefix、普通 pending 读取的 Hash.update 为 0；snapshot 只保留所选内容，仍 hash 全部 unique 对象总 bytes，重复 OID 不重复 hash，默认零保留 selection 仍有非空指纹。
- 两指纹模式保留逐字节二进制 frame、missing/type/identity/size、separator/truncated/trailing、stdout 累计及真实 stderr 各 256MiB 预算、非零进程退出和完整 payload 截断。transport fixture 在消费请求后输出响应，使非零退出与截断观察不受未读 stdin 的竞速干扰。
- 普通 history prefix、LF/CRLF/孤立 CR、UTF-8 cutoff、EOF/long-header fallback、legacy/moved/index差异的真实 source-presence、无关 formal missing/corrupt 警告，以及默认 full read 失败、opaque CAS 同 OID actual bytes 漂移、锁内完整身份、范围内/外 sentinel、staged 删除和读回恢复均沿原入口真实执行。完整 payload I/O、完整 pending 成员与物理 index 复制仍存在；没有削减这些护栏。
- 六个实际生成 runtime consumer 已通过公开同步与一致性检查。typecheck、lint、Case 覆盖与 Gate catalog 测试已实际通过；质量配置和豁免不变。最终代码与生成物收敛后的 `bun run check` 保留完整 68 项 Definition，65 项实际执行并 passed，0 failed／unavailable，3 项 release-only 未执行，本次未复用日常 receipt。

未做真实 CPU／墙钟隔离对照，扫描及 hash.update 计数不能推出整体 CLI 加速；未验证跨平台或其他 Node/Git 版本的广泛深度上界，也未执行 release-only 打包。完整 payload I/O、完整 pending 成员、物理 index 复制与既有 fresh phase、固定 HEAD、错误净化、CAS 和恢复责任继续适用。上述证据不证明 atomic FS、结束时 freshness、全部 stage O(K) 或 Git 进程常数。改变索引生命周期、循环输出、指纹结果构造或完整 payload/CAS 失败责任时，应重新调查。

## 随附资源

- [after.json](./_resources/261011-investigation-batch-lookup-iterative-graph-and-demanded-fingerprints/after.json)
- [before.json](./_resources/261011-investigation-batch-lookup-iterative-graph-and-demanded-fingerprints/before.json)
- [measure.mjs](./_resources/261011-investigation-batch-lookup-iterative-graph-and-demanded-fingerprints/measure.mjs)
