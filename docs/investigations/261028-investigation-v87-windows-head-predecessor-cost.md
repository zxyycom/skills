---
title: "调查报告 v87 在 Windows 上全量检查的前序 Git 调用放大"
id: "261028-investigation-v87-windows-head-predecessor-cost"
formedAt: "2026-10-28T02:39:36Z"
question: "344 份报告的约 94 秒检查主要耗在哪里，是否为 v87 缺少性能优化导致？"
tags:
  - "git-integration"
  - "investigation-report"
  - "performance"
  - "root-cause-analysis"
  - "windows"
relations:
  - type: "补充"
    target: "261009-skill-cli-repeated-process-and-source-access"
    summary: "补充 v87 Windows 实测，定位前序逐份读取的进程放大"
---

## 形成时背景

外部 Windows 项目使用 Investigation Report v87，执行 `node .codex/skills/investigation-report/scripts/check-investigations.ts check` 后，344 份报告全部通过、索引为 current，外部记录耗时 93.914 秒。用户希望确定耗时来源，以及升级是否能解决问题。

调查先核对版本历史，再由外部项目 agent 在原环境只读采集，上游据用户提供的 `investigation-report-v87-performance-20261028.zip` 复核事件与源码。证据将问题收敛到 **208 个唯一前序报告的逐份 Git 读取**；资源检查是次要成本。

前序[其他 Skill CLI 的重复进程与集合读取](skill-cli-repeated-process-and-source-access.md)曾指出历史读取的 revision/tree 重复获取，其全量检查样本为无关系集合。本轮补充有关系的 Windows 真实项目证据。

## 调查目的

区分启动、正文处理、资源检查和 Git HEAD 前序核对的成本，以事件、版本指纹及调用链确定优化优先级。交付为诊断结论和证据，优化效果由后续实施验证。

## 调查范围与依据

### 证据与方法

- **现场采集**：2026-10-28 北京时间约 10:03–10:11，原项目串行执行两次普通检查、一次完成的插桩检查，保留环境清单、事件和采集脚本。
- **上游复核**：在仓库快照 `9556c5a6` 读取附件、核对源码；21 项包内 SHA-256 全部匹配，独立重算 631 条子进程事件的次数、区间并集与阶段归属，均与摘要一致。Windows 实测来自外部项目，上游负责证据复核。
- **版本对照**：外部 273 个指纹中，268 个与 v87 快照 `64527516` 匹配，包含关键调用链；另 5 个额外路径来源未核实。`git diff --quiet 64527516 9556c5a6 -- skills/investigation-report/scripts` 退出 0，证明本轮 v89 与 v87 的该分发运行时目录相同。

插桩通过 preload/`registerHooks` 在内存包装函数，记录阶段、文件操作和子进程，受检文件保持原样。阶段时长包含内层操作，使用包围阶段或区间并集归因，避免重复求和。样本未清缓存；插桩净开销和普通复测间波动尚待量化。

### 环境与规模

| 项目 | 现场条件 |
| --- | --- |
| 运行环境 | Node v24.20.0，Git 2.54.0.windows.1，Windows 11 Home China / 10.0.26200 x64，D: Fixed NTFS。 |
| 硬件与内存 | Ryzen AI 7 H 450，16 逻辑处理器；内存约 33.46 GB，采集时空闲约 2.94–3.07 GB。 |
| 报告与索引 | 344 正式、0 候选；Markdown 共 3,649,619 字节；索引 559,967 字节、251 条边、208 个唯一直接前序。 |
| 资源 | 2,563 文件、300,413,633 字节、262 目录，最大目录深度 4；唯一直接引用 2,531，均为 Git 可见资源，另 32 个 ignored 文件未引用。 |

环境、依赖解析和逐文件指纹见 `external-inventory.json` / `external-imports.json`。随附证据约 167 KB：6 份原样文本、全部子进程事件及 10 个包围阶段区间的节选、复核溯源。节选保留原值，文件操作明细与 CPU profile 由摘要承接；采集脚本用于形成时方法审计，重跑需适配脱敏路径和依赖。

## 调查结果与边界

### 耗时分布

两次普通复测分别为 **61.343 / 82.542 秒**，插桩复测为 **75.053 秒**，三次均 exit 0、344 份检查通过。插桩中 **Git HEAD 前序核对占 85.5%**，资源检查占 12.3%。下表按该次墙钟计算，列出不重叠的大阶段。

| 阶段 | 本次时长 | 墙钟占比 |
| --- | ---: | ---: |
| CLI 前启动/导入，含 preload | 0.821 s | 1.1% |
| 集合发现及安全读取 | 0.432 s | 0.6% |
| 完整资源验证 | 9.251 s | 12.3% |
| 来源快照构造 | 0.017 s | 小于 0.1% |
| 当前索引验证 | 0.065 s | 0.1% |
| Git HEAD 前序核对整体 | **64.148 s** | **85.5%** |

344 份完整 Markdown 解析合计 **19.3 ms**，关系上下文与图验证约 1.9 ms。主要优化对象由此收敛为 Git 调用，其次为资源检查；启动、正文与索引计算在本样本中占比较小。

### 因果链：208 个前序 × 每份 3 次串行 Git

领域入口 [validation-history.ts](../../tools/investigation-report/src/records/validation/validation-history.ts) 去重关系目标并加载 HEAD 索引后，在 `readRecordedPredecessors` 中逐份 `await repository.readRevisionFile(revision, target)`。共享入口 [git-revision.ts](../../tools/shared/src/version-control/git/revision/git-revision.ts) 每次解析 revision、查询 tree、读取 blob，对应 `rev-parse → ls-tree → cat-file`。

| Git 类别 | 整个 check 次数 | 整个 check 累计生命周期 | 其中前序循环次数 |
| --- | ---: | ---: | ---: |
| rev-parse | 212 | 22.149 s | 208 |
| ls-tree | 209 | 21.014 s | 208 |
| cat-file | 209 | 20.801 s | 208 |
| ls-files | 1 | 0.090 s | 0 |
| 合计 | **631** | **64.054 s** | **624** |

子进程生命周期区间没有重叠，累计与区间并集一致。前序循环本身为 **63.698 秒**，其中 624 次子进程合计约 63.275 秒，平均每次约 **101 ms**；循环外还有资源发现、HEAD 索引及上下文准备等 7 次调用。

底层 [git-blob-batch.ts](../../tools/shared/src/version-control/git/git-blob-batch.ts) 使用 `cat-file --batch`，单文件入口每次只传一个 object ID。**集合级循环反复进入单项 Git 入口**，使进程数量随唯一前序数增长。

独立观测中，8 次 `git --version` 合计 1.042 秒、8 次 `rev-parse` 合计 1.136 秒，支持现场小命令的固定成本显著。此证据定位到进程调用放大，具体启动、Git 初始化、安全软件及调度开销仍待区分。

### 次要成本：资源安全元数据访问

完整资源检查约 9.251 秒，包含资源成员发现的 Git 调用约 0.367 秒。归入资源类别的文件操作 54,172 次，累计约 8.530 秒；其中 lstat 29,319 次/4.529 秒、realpath 14,238 次/2.846 秒。资源内容读取为 0 次，成本来自路径、普通文件身份、owner 和版本控制可见性检查。

部分公共路径 lstat 达 7,600 次、realpath 达 2,536 次，可进一步评估同阶段目录事实复用。安全检查语义及准备、复核阶段的独立取证应继续保留。

### 版本判断与优化顺序

v87 已包含 `3c1d9110` 的首次采集复用，以及 v85 `f381715c` 的集合成员元数据有界并发。这些优化覆盖其他路径，本次瓶颈仍是前序逐份读取。v87 与本轮 v89 的分发运行时相同，单纯升级到该 v89 缺少加速依据。

**判断**：现有历史读取路径与现场小进程成本共同造成分钟级等待；报告数量本身不足以预测耗时。优化按以下优先级推进，效果以同环境实测为准：

1. **批量历史读取**：在历史读取 owner 对同一 revision 的所需目标评估 `readRevisionFiles`/blob 批量能力，将逐份进程收敛为少量批次。读取限于必要目标，保留路径精确性、文件类型、正文 ID、历史索引与失败诊断。
2. **资源检查复用**：评估单阶段目录事实复用或有界并发，保持路径替换、符号链接和错误排空边界。
3. **同环境验收**：在原 Windows 集合比较检查结果、warning、Git 次数与端到端时长，分别证明语义保持和实际加速。

### 证据边界与复查条件

- **计时归属**：原始 93.914 秒的计时边界未知；普通复测为外部工具输出转录，原 transcript 已失效。阶段占比仅属于一次插桩运行，支持同量级慢的归因，不用于估计稳定延迟或精确分摊原始 94 秒。
- **验证范围**：上游复核附件与对应源码，尚未在外部 Windows 集合重跑或实施优化。外部 completion 的文件指纹及 Git 状态一致性为采集方自述，详细溯源见附件。
- **重新调查**：历史读取 API、前序核对语义、集合/关系形状或 Windows/Git/Node/包装器变化时，以及需要解释运行波动时重新测量。跨平台、大型历史正文、Git 故障和并发漂移需单独覆盖。

## 随附资源

- [外部两次普通复测转录及其来源限制](./_resources/261028-investigation-v87-windows-head-predecessor-cost/external-baselines.json)
- [全部子进程事件及包围阶段区间节选](./_resources/261028-investigation-v87-windows-head-predecessor-cost/external-events-excerpt.json)
- [外部独立导入耗时与实际依赖解析位置](./_resources/261028-investigation-v87-windows-head-predecessor-cost/external-imports.json)
- [外部环境、数据规模及受检文件指纹](./_resources/261028-investigation-v87-windows-head-predecessor-cost/external-inventory.json)
- [形成时内存插桩采集脚本，只供方法审计](./_resources/261028-investigation-v87-windows-head-predecessor-cost/external-observe.mjs)
- [外部阶段、文件操作、Git 及 CPU 采样摘要](./_resources/261028-investigation-v87-windows-head-predecessor-cost/external-summary.json)
- [外部启动区分观测、Git 分阶段计数及关键指纹](./_resources/261028-investigation-v87-windows-head-predecessor-cost/external-validation-summary.json)
- [压缩包校验、v87 对照及节选留存溯源](./_resources/261028-investigation-v87-windows-head-predecessor-cost/review-provenance.json)
