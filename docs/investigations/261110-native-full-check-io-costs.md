---
title: "原生记录 CLI 性能回退与成本放大复核"
id: "261110-native-full-check-io-costs"
formedAt: "2026-11-10T02:22:06Z"
question: "原生记录 CLI 是否在多个入口丢失旧性能优化，当前还有哪些可达的进程与算法成本放大，证据能支持到什么程度？"
tags:
  - "algorithmic-complexity"
  - "decision-records"
  - "investigation-report"
  - "performance"
  - "record-cli"
  - "windows"
relations:
  - type: "复查"
    target: "261108-record-cli-native-complexity-survey"
    summary: "在生产切换后复查历史读取与资源目录的工作量"
---

## 形成时背景

用户报告 Windows 上调查全量检查 376 份记录从 10.08 秒增至 36.02 秒；原命令、二进制版本、输入和采样方式未知。这是调查线索，不是本轮可复现的基线。[前序普查](./261108-record-cli-native-complexity-survey.md)发现的同一历史目标重复读取已由 `f989afee` 去重；本轮复查生产切换后的唯一目标读取和其他入口，保留独立输入与证据。

## 调查目的

判断原生迁移是否丢失旧优化、哪些进程与算法成本放大真实可达，区分完整命令墙钟、工作量计数和静态分析。调查扩展到两域 stage、selected sync 与正文处理；随后按授权修复并以相同私有输入对照。Windows 原始调用不在本轮验证范围。

## 调查范围与依据

2026-11-10 起始 HEAD 为 `4fdeb5581defcffedf65159b2fc52c58610c7598`，原生基线 0.2.1，IR 二进制 SHA-256 `4d9a4a54eb8a72e7a0ef1903a390456eb6fe449c92cac7635696f15496204acd`；隔离重建与 prepared 资产一致。旧 Node 端取迁移前 `a88af9bc029a1539c3abe57f69d752e4d39a868e` 的完整生成脚本树，使用 Node 26.8.2 和当前可解析依赖，未重建历史锁定依赖闭包。环境为 Linux x86_64 WSL2、ext4、4 个可用 CPU、Git 2.53.0、Rust 1.98.1；未清系统缓存，宿主非独占。

首次比较用四个私有 Git 仓库：各 376 份正式报告、无候选，关系为 0 或 250 个不同前序目标，资源为 0 或 1504 个 8 字节附件（376 个 owner 目录）。两端 full check 成功并核对输入；原生 JSON 8213 字节、旧端文本 77 字节，输出并非同形。02:16:08–02:20:26 UTC 用种子 261110 交错采样，每端每格 20 次，共 160 次完整新进程墙钟；结果按中位数和 nearest-rank P95 汇总。Git Trace2、阶段插桩及旧端 `readdir` 计数另在每场景各运行一次，阶段时间 inclusive，目录计数不是系统调用数。输入树、可执行文件、测量脚本等首尾守卫一致，旧 Node 传递依赖未逐文件冻结。

扩展审查覆盖两域查询、full/selected check 与 sync、authoring、关系及 stage 的主要路径，不是全部参数或错误路径。公开 stage 探针每域 32 份来源、34 个 pending 成员（32 文档、域索引、域外文件），以 K=1/8/32 个完整 ID 选择；每档每端一次 Trace2，并逐字验证所选和未选 pending 与索引。DR 重划探针使用合法二部链，CLI 验证闭包；边检查数来自外部模型而非 CLI 插桩。

修复后候选为原生 0.2.2（Decision skill 115、Investigation skill 104），源码摘要 `24bdf0128ff51d13314844aaaed531cfb7bc2546846e25764565ee70c6557aad`，最终采样候选为 `generation-9H4TXz`。0.2.1 与 0.2.2 在相同私有输入复测：IR check 沿用上述四种负载；stage 每域 32 来源、34 index 成员，其中 33 个 pending 路径有变化。04:06:41–04:08:38 UTC 每场景每端 20 次墙钟，共 **400 次**；另加 20 次 warmup 和 20 次独立 Trace2，共 **440 条 oracle**。脚本逐次断言输出及 index，manifest 明文未保留，记录的是执行断言与摘要，因此不能独立重放每次文件内容。

资源中 `results.json`、`samples.jsonl` 与 `measure.py` 保存首次对照；`diagnose-*`、`instrumentation.patch`、`old-profile.mjs` 保存独立计数方法；`wide-audit.md` 和 `wide-*` 保存扩展审查、stage 与闭包证据；`implementation-*` 保存此前候选 `generation-9yliYR` 的历史复测；`post-review-*` 保存最终候选的复测样本、oracle、汇总、工作量、输入清单、守卫及故障探针。资源不含大 fixture 或二进制，不构成可直接重跑的完整环境。

## 调查结果与边界

**确认旧版历史批量读取在原生迁移中退回逐目标调用，其他入口也存在成本放大；本轮已实施修复。** Linux 私有输入的 0.2.2 对照显示历史与资源场景明显改善，普通无关系场景基本持平。未知 Windows 调用的原因及修复幅度仍未证明。

### 关键机制与修复

| 入口与修复前依据 | 已实施的处理及边界 |
| --- | --- |
| IR full check：旧端去重后用一次树查询和 `cat-file --batch` 读取；0.2.1 虽去重，仍对每个唯一目标分别运行 `ls-tree`、`cat-file blob` 和 `hash-object`。250 目标另加历史索引形成各 251 次，连同其他调用共 758 个 Git 进程；旧端为 11。独立插桩历史阶段约 1178 ms，正文采集解析约 7.2 ms。 | 恢复固定 revision、显式所选目标的批量树与 blob 读取，保留路径、mode、身份、OID 绑定、预算和错误语义。真实工作区修改前 106 份报告、43 个不同目标的独立 Trace2 为 141 个进程，是机制代表而非用户负载。 |
| 资源路径：1504 资源组原生枚举目录 3010 次、访问成员 572274 个；其中 `_resources` 根 1505 次、565880 个成员。旧端 `readdir` 为 378 次、2258 个成员，仍有其他文件系统复核，不能据此比较全部 I/O。 | 共享目录观察并保留身份、类型、大小写及 namespace 复核。资源数 R 与 owner 数 D 可引入约 R×D 成员处理；原先本机该场景仍整体快于旧端。 |
| stage：0.2.1 逐所选 pending blob 读取，IR 还逐 owner／scope 查询；旧端使用批量读取及预算合批。下表公开入口计数确认增长，并非墙钟。 | 恢复所选 pending 的批读取与 literal scope 批查询及预算回退。去重后至少 8 个不同内容的对象准备最多 4 个 worker，全部完成后才更新 index；失败按输入顺序报告，失败可能留下不可达对象但不改 index。 |
| selected sync 名称解析从近 Θ(N+K) 退回 Θ(KN)；完整日期 ID 仍走索引。DR full check 同一正文发生重复 YAML 加载，未测各解析步骤耗时。 | 调用内建立名称索引，DR 复用来源解析；保留诊断与无效输入语义。 |
| DR 重划闭包反复扫边，stage 路径关联和 IR owner 验证存在乘积工作；后两项主要为静态证据。合法链在 20/40 后继时外部模型分别计 1600/6400 次边检查，非 CLI 实测。 | 重划闭包、资源 owner 与 stage 关联改用索引；选择操作仍需完整依赖闭合。 |

OID 校验改用启用碰撞检测的 `sha1collisiondetection`；独立碰撞向量证明检测生效，不证明 Git 前缀碰撞攻击。修复涉及多个机制，以下整体结果不能分配给单项优化。

### 原始回退证据

首次完整 CLI 对照，单位秒，中位数 / P95，每格 20 次：

| 376 份报告的输入 | 旧 Node CLI | 原生 0.2.1 |
| --- | ---: | ---: |
| 无关系、无附件 | 0.922 / 0.956 | 0.0108 / 0.0123 |
| 250 个不同前序、无附件 | 1.031 / 1.069 | 1.197 / 1.246 |
| 无关系、1504 个附件 | 3.887 / 3.998 | 0.322 / 0.329 |
| 250 个不同前序、1504 个附件 | 4.017 / 4.089 | 1.463 / 1.508 |


无关系输入原生更快；250 个不同前序、无附件时原生中位数约慢 16.1%，说明历史进程成本足以抵消其他优势，而不是原生解析普遍慢。资源与组合场景整体仍快于旧端。不同格式输出和未恢复完整历史依赖限制跨版本比较。

公开 stage 的独立 Trace2，数字为 Git 进程数而非时长：

| 领域 | K=1：旧 → 原生 | K=8：旧 → 原生 | K=32：旧 → 原生 |
| --- | ---: | ---: | ---: |
| Decision | 22 → 23 | 29 → 51 | 53 → 147 |
| Investigation | 38 → 34 | 45 → 97 | 69 → 313 |


12 次均成功，强化 probe 后逐字验证选中正文与工作区一致、未选正文保持原 pending、域外暂存内容保持、两端 staged 索引一致。初版只验证未选正文不同于工作区，证据不足，强化后全部重跑且计数不变。两端都有必要的逐对象写入，不能将全部增加归因于无用工作。

### 修复后 Linux 对照

下表为完整新进程墙钟，单位毫秒，中位数 / nearest-rank P95（第 19 项），每格 20 次：

| 场景 | 0.2.1 基线 | 0.2.2 修复后 |
| --- | ---: | ---: |
| IR check 无关系无资源 | 10.94 / 14.10 | 10.69 / 14.01 |
| IR check 历史 | 1127.19 / 1476.05 | 57.35 / 65.15 |
| IR check 资源 | 314.17 / 323.22 | 52.70 / 77.71 |
| IR check 历史与资源 | 1404.21 / 2522.78 | 100.21 / 119.02 |
| DR stage K=1 | 35.89 / 54.07 | 25.90 / 27.18 |
| DR stage K=8 | 76.31 / 128.54 | 29.42 / 31.01 |
| DR stage K=32 | 205.85 / 337.07 | 41.96 / 51.61 |
| IR stage K=1 | 51.72 / 95.17 | 39.02 / 54.31 |
| IR stage K=8 | 138.69 / 151.56 | 42.23 / 70.37 |
| IR stage K=32 | 439.10 / 498.65 | 57.55 / 97.07 |


独立 Trace2：IR 历史 check 的 Git 进程 **758→12**、组合 **762→16**；DR/IR stage K=32 分别 **147→47、313→56**。资源组两端均为 4 个 Git 进程，耗时变化不能归因于 Git 进程减少。无关系无资源组约 11 ms，不宣称明显收益。

最终批次的 plain 两端未产生 Trace2 文件；结合无关系、无资源输入及两代源码路径，独立复算只将这两项缺失 trace 计为 0，其他缺失仍报错。采样脚本断言首尾 fixture、资产及输入摘要一致；这不是不可篡改时间戳或可复现构建证明。此前 `implementation-*` 批次的汇总器曾因同一零 Git 文件缺失中止，随后独立复算，无样本被删除。局部不同内容 Git 对象写入探针每组仅 5 次：K=8/32/128 时四并发中位数比串行低约 38%/53%/58%，K=1 反慢约 33%；它支持并发阈值选择，不代表 stage 或 Windows 收益。初始预采样脚本错误中止，修正后重跑。

### 验证与适用边界

最终候选修正 stdout 与 stderr 预算错误分类，避免 stderr 超限误触批读取回退。私有 Git 包装器注入 stderr 超限时，此前候选退出 0、无 warning，运行 2 次 batch、250 次 `cat-file -t` 和 251 次 blob 读取；最终候选退出 0、报告历史不可用 warning，运行 1 次 batch 与 251 次 blob 读取。该结果支持 stderr 不再误触 batch stdout 的逐对象恢复，但上层历史诊断仍有逐对象回退；无注入时两者均成功且无 warning。这只证明定向故障，不概括所有错误路径。原生测试与独立审查完成；`record-rust`、`investigation-collection`、`test-evidence-project` 三 scope 加 quick 共 24 项通过、39 项未选。MSVC all-targets 交叉检查通过，测试模块有 unused-import warning；**这不是 Windows 原生运行**。本轮不证明未知 Windows 请求、冷缓存、所有错误路径、并发文件变更或正式发布。实际 Windows 耗时还需要原命令、版本、输入与本机采样；更高进程或目录访问成本可能放大上述机制，但只是推断。

首次 fixture 的 flow-style tags 被规范解析器拒绝，正式采样前改为 block-style；原 native diagnostics 在零 Git 调用时错误期待 Trace2 文件，改用独立脚本后取得数据。这些纠正未删除或重分类正式样本。扩展 stage 资产只在重跑后记录尾指纹，不作为该批首尾稳定性证明。形成时未发布二进制；当前操作与平台验收入口见 [Record CLI 维护](../../tools/record-cli/README.md)。

## 随附资源

- [diagnose-native.py](./_resources/261110-native-full-check-io-costs/diagnose-native.py)
- [diagnose-old.py](./_resources/261110-native-full-check-io-costs/diagnose-old.py)
- [implementation-bench.py](./_resources/261110-native-full-check-io-costs/implementation-bench.py)
- [implementation-end-guards.json](./_resources/261110-native-full-check-io-costs/implementation-end-guards.json)
- [implementation-environment.txt](./_resources/261110-native-full-check-io-costs/implementation-environment.txt)
- [implementation-independent-summary.json](./_resources/261110-native-full-check-io-costs/implementation-independent-summary.json)
- [implementation-inventory.json](./_resources/261110-native-full-check-io-costs/implementation-inventory.json)
- [implementation-oracle.jsonl](./_resources/261110-native-full-check-io-costs/implementation-oracle.jsonl)
- [implementation-recompute.py](./_resources/261110-native-full-check-io-costs/implementation-recompute.py)
- [implementation-samples.jsonl](./_resources/261110-native-full-check-io-costs/implementation-samples.jsonl)
- [implementation-trace-counts.json](./_resources/261110-native-full-check-io-costs/implementation-trace-counts.json)
- [implementation-write-probe-metadata.json](./_resources/261110-native-full-check-io-costs/implementation-write-probe-metadata.json)
- [implementation-write-probe-samples.jsonl](./_resources/261110-native-full-check-io-costs/implementation-write-probe-samples.jsonl)
- [implementation-write-probe.py](./_resources/261110-native-full-check-io-costs/implementation-write-probe.py)
- [instrumentation.patch](./_resources/261110-native-full-check-io-costs/instrumentation.patch)
- [measure.py](./_resources/261110-native-full-check-io-costs/measure.py)
- [old-profile.mjs](./_resources/261110-native-full-check-io-costs/old-profile.mjs)
- [post-review-bench.py](./_resources/261110-native-full-check-io-costs/post-review-bench.py)
- [post-review-fault-result.json](./_resources/261110-native-full-check-io-costs/post-review-fault-result.json)
- [post-review-fault_probe.py](./_resources/261110-native-full-check-io-costs/post-review-fault_probe.py)
- [post-review-independent-summary.json](./_resources/261110-native-full-check-io-costs/post-review-independent-summary.json)
- [post-review-independent-trace-counts.json](./_resources/261110-native-full-check-io-costs/post-review-independent-trace-counts.json)
- [post-review-inventory.json](./_resources/261110-native-full-check-io-costs/post-review-inventory.json)
- [post-review-oracle.jsonl](./_resources/261110-native-full-check-io-costs/post-review-oracle.jsonl)
- [post-review-recompute.py](./_resources/261110-native-full-check-io-costs/post-review-recompute.py)
- [post-review-samples.jsonl](./_resources/261110-native-full-check-io-costs/post-review-samples.jsonl)
- [post-review-summary.json](./_resources/261110-native-full-check-io-costs/post-review-summary.json)
- [results.json](./_resources/261110-native-full-check-io-costs/results.json)
- [samples.jsonl](./_resources/261110-native-full-check-io-costs/samples.jsonl)
- [wide-audit.md](./_resources/261110-native-full-check-io-costs/wide-audit.md)
- [wide-process-counts.json](./_resources/261110-native-full-check-io-costs/wide-process-counts.json)
- [wide-reallocation-probe.py](./_resources/261110-native-full-check-io-costs/wide-reallocation-probe.py)
- [wide-reallocation-results.json](./_resources/261110-native-full-check-io-costs/wide-reallocation-results.json)
- [wide-stage-probe.py](./_resources/261110-native-full-check-io-costs/wide-stage-probe.py)
