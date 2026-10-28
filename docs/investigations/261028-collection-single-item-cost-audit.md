---
title: "决策与调查工具的集合成本与入口覆盖审计"
id: "261028-collection-single-item-cost-audit"
formedAt: "2026-10-28T03:18:27Z"
question: "决策与调查工具的公开入口还存在哪些重复获取、乘积扫描或未消费计算，已知问题与覆盖边界是什么？"
tags:
  - "decision-records"
  - "git-integration"
  - "investigation-report"
  - "performance"
  - "root-cause-analysis"
  - "skill-tooling"
relations:
  - type: "补充"
    target: "261028-investigation-v87-windows-head-predecessor-cost"
    summary: "沿集合调用单项模式扩查版本门禁与记录批量路径"
---

## 形成时背景

[Windows 前序检查调查](261028-investigation-v87-windows-head-predecessor-cost.md)确认，208 个前序触发 624 次串行 Git 调用。本轮据此扩查两记录工具：先定位集合入口的单项调用放大，再由 GPT-6.1 Terra 负责人及两个领域切面复核公开入口与共享层，主代理完成证据复核。

调查基线为 `696b888b`。结果表明，重复工作分布在多个准备、选择和验证站点，优化需要沿调用链处理；本报告保存发生位置、机制与覆盖边界，生产实现保持原样。

## 调查目的

形成决策与调查工具的成本清单，区分已确认机制、既有补证、必要工作和待取舍候选，为后续优化排序及验收提供依据。

## 调查范围与依据

- **入口与源码**：决策 18、调查 14 个业务命令逐项对账，SDK 对照源码出口与生成声明。机械筛查涉及 401 个 TS 文件；静态依赖闭包为 394 个，含类型 import，闭包外 7 个归构建或独立 API。覆盖清单按可达核心成本归类，分母用于说明范围。
- **取证**：真实只读版本门禁使用 Git Trace2；领域热点主要以原函数、只读上下文或隔离回调计数。Git 写对象及 index 标志实验使用无 remote、禁 hook 的临时仓库。主代理复核矩阵、源码引用，并重跑非法图与名称关系两组探针。
- **环境**：Linux，Node v26.8.2、Bun 1.4.4、Git 2.53.0。getter、Proxy、临时 wrapper 和 IO stub 用于计数，函数探针时间仅反映该构造。

先读 `terra-audit-findings.json` 的站点台账、`terra-audit-coverage.csv` 的命令覆盖和 `terra-audit-gaps.json` 的候选处置。源码闭包见 `terra-audit-scope.json`，原始计数与方法见 `terra-audit-results.json` / `terra-audit-methods.md`；两阶段指纹与主代理重跑由各自溯源文件承接。附件是形成时证据，重跑需恢复相应版本、路径和依赖。

## 调查结果与边界

### 核心结论

**同阶段重复查找、集合物化和单项 Git 调用是主要优化对象。** 台账共 20 条机制/候选记录、29 处源码引用，包含新增站点、既有补证与取舍候选；同一根因可涉及多个入口。

32 个命令及共享编排、搜索、图和 Git 的可达核心成本已按清单处置，本轮提出的静态疑点均有归类。8 项仍需设计、合法可达性或等价验证的候选另列。证据确认的是工作量机制；完整命令影响和优化收益由后续实测判断。

### 批量路径中的重复扫描

N=索引/身份数，K=所选数，C=候选数，G=关系分组数，P=pending 成员数，R=资源 owner 数，F=受管资源文件数。以下按修复责任归组，精确站点和各样本条件见台账。

| 路径 | 机制与代表计数 |
| --- | --- |
| 决策生命周期选择 | 已发布 ID 数组逐项 includes，N×selector 数；N=K=1,000 时 500,500 次比较。archive、evolve、set-relations 可达。 |
| 决策候选与维护 | 候选成员查找、records 去重、evolve 的 record/group 查找呈 C×K 或 K²/K×G 增长；history 路径即使已在索引中仍扫描所选/必要 records。K=200 的去重比较为 19,900 次。 |
| 两域暂存定位 | 决策逐 payload 物化完整索引；N=10,000/K=100 时 1,000,000 个条目值。调查 domain 定位及 all/domain 所有权检查也有 N×K/P×K；index scope 对所有权分支早退。 |
| 调查发布与关系维护 | selector 解析后，publish 准备仍逐项检查候选存在性；关系计划、成功读回与恢复验证也重复匹配 changed IDs。C=1,000/K=100 时各处为 95,050 次访问，成功与恢复回调互斥。 |
| 调查候选资源 | owner 存在性按 R×N 查找；Git 资源根 ready 时还逐候选展开全部 F 个资源路径。F=1,000/K=100 时后者为 100,000 次迭代；非 Git 按 owner 树读取。 |

候选方案是在**每个独立阶段建立一次 ID/name/path 索引**，复用 Set/Map；同时保持首匹配、歧义、candidate/legacy fallback、错误顺序和路径所有权。准备与 fresh 各自取得当前事实。

### 其他热点及取舍

| 情形 | 确认证据与优化边界 |
| --- | --- |
| 决策重划闭包 | M 个组件重复检查 K 个所选 successor；M=K=200 时 40,001 次成员检查。闭包函数返回成功，完整合法 evolve 尚待验证；调整交集方向需保持首匹配组件及诊断。 |
| stage 对象写入 | 40 个相同的新 payload 仍启动 40 次 hash-object，观测峰值 40 个存活 Git child。可评估同字节去重及有界并发，保持必要的唯一对象写入、错误和锁语义。 |
| 普通 trace | 提前生成未消费的深度截断邻接结果，再由 adapter 取邻接；100 节点链为 200 次 source Map.get。按需计算须保持动态 getter 和截断语义。 |
| 非法图错误分支 | 深路径上的短回环反复触发栈 indexOf，N=1,000 时 499,499 次比较。优化须保持全部环诊断及顺序，成本归因限于该错误输入。 |
| pending 全范围重放 | 一项变化仍向 update-index 发送 P 个目标记录，no-op 不写。属于取舍候选：全量重放会清 skip-worktree/assume-unchanged 标志，差量更新需先确认标志、CAS 与未选保护的等价性。 |

版本门禁是本轮关联的跨工具发现：真实 `hash:skills --quiet` 耗时 **7.075 秒**，1,343 个不同文件各走三次 Git，共 **4,036 个进程**。它属于 pre-commit/release 路径，与两域 32 命令的覆盖分开；可评估同 revision 分批读取，保留差异短路和版本规则。

### 历史归属与排除项

[常数成本审计](decision-investigation-constant-factor-audit.md)的 C9/C10/C11 已记录搜索范围映射、重复分行和决策 new 名称关系 lookup；索引重复 canonical 化见[既有调查](261024-record-index-computation-and-transfer.md)。逐目标 hash-object、trace 邻接和非法回边也已有观察，本轮补充具体站点及计数，台账保留其历史归属。

排除与必要性判断集中如下：

- 搜索命中通过两个数组下标映射 span；范围生成先于预览裁剪，但受文件/总字节预算约束。按需优化须保持 Unicode、跨段 all、精确计数和截断语义。
- 决策历史正文采用批量读取；决策 check 处理来源指纹，调查 check 另有 HEAD 前序核对。两域未发现调用通用 reader.all 重复分页的对应消费者，共享 selected sync 已建立 ID/name 索引。
- 完整索引/图检查、精确匹配计数、资源 live identity、独立 fresh、pending CAS、恢复和写后验收各有职责；pathspec 按传输预算分批。它们按契约保留，优化限于已证明重复或未消费的工作。

### 优化顺序与验证边界

1. 收敛已测的调查历史 Git 调用和版本门禁进程。
2. 按实际批量负载处理阶段内定位/物化、相同对象写入与并发、资源集合准备。
3. 对图、搜索和规范化候选验证收益与等价性；每项同时核对结果、错误及工作量，分别变化 N、K、C、关系、资源与字节量。

本轮完成源码成本审计与定向计数，优化尚待实施。Windows、冷缓存、并发/漂移、容量上限，以及完整命令的 no-op、无 HEAD、非 Git、legacy 和故障恢复仍需系统动态验证；局部函数成功与完整事务可达性的差别已逐项记录。静态覆盖结论适用于所列入口和机制，端到端收益以目标平台验收为准。

## 随附资源

- [首轮 selector 与 pending locator 的原函数计数](./_resources/261028-collection-single-item-cost-audit/batch-selection-results.json)
- [Git 单路径请求去重与 skill 分布](./_resources/261028-collection-single-item-cost-audit/hash-cli-path-summary.json)
- [公开版本门禁的实际计时与 Git Trace2 汇总](./_resources/261028-collection-single-item-cost-audit/hash-cli-trace-summary.json)
- [首轮决策维护上下文及历史路径映射计数](./_resources/261028-collection-single-item-cost-audit/lookup-results.json)
- [形成时公开命令与 Trace2 采集方法](./_resources/261028-collection-single-item-cost-audit/measure-hash-cli.py)
- [首轮 selector 与私有 locator 探针方法](./_resources/261028-collection-single-item-cost-audit/probe-batch-selection.mjs)
- [首轮只读维护与历史映射探针方法](./_resources/261028-collection-single-item-cost-audit/probe-lookups.mjs)
- [首轮版本、环境、源码指纹及方法边界](./_resources/261028-collection-single-item-cost-audit/provenance.json)
- [32 个命令的静态处置与动态边界](./_resources/261028-collection-single-item-cost-audit/terra-audit-coverage.csv)
- [根因、新旧归属与 29 处源码引用台账](./_resources/261028-collection-single-item-cost-audit/terra-audit-findings.json)
- [具体候选取舍、排除项及未验证范围](./_resources/261028-collection-single-item-cost-audit/terra-audit-gaps.json)
- [Terra 形成时探针代码与方法](./_resources/261028-collection-single-item-cost-audit/terra-audit-methods.md)
- [Terra 交接指纹、主代理引用检查及两组重跑](./_resources/261028-collection-single-item-cost-audit/terra-audit-provenance.json)
- [Terra 原函数、隔离 Git 及回调计数结果](./_resources/261028-collection-single-item-cost-audit/terra-audit-results.json)
- [入口闭包、SDK、机械分母及共享模块处置](./_resources/261028-collection-single-item-cost-audit/terra-audit-scope.json)
