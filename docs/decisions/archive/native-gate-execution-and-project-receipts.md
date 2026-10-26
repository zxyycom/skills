---
title: 以原生执行和项目完整输入证明组织 Gate
id: 261020-native-gate-execution-and-project-receipts
status: archived
alignment: aligned
createdAt: 2026-10-20T07:38:28Z
purpose: 降低 Gate 自建运行职责，同时可靠省略输入相同且已通过的项目命令。
background: 材料检查能原生结算，独立命令已能保存终态与诊断；项目仍需最近成功输入与最终发布事务。
decision: 原生材料每轮结算、项目命令独立执行，仅完整输入精确命中的项目 Check 可复用 receipt，release 与 CI 全执行。
tags:
  - project-tooling
  - responsibility-boundaries
  - vibe-gate
relations:
  - type: 修订
    target: 260909-incremental-vibe-gate
    summary: 保留成功输入事务，收窄为项目命令证明并以原生能力承接执行和材料结算
  - type: 修订
    target: 260912-isolate-release-version-control-resource-boundary
    summary: 退役前序保留的批次执行与证明，隔离另由资源后继承接
---

## 目的

- 保持唯一可信的 Gate 结论，并让未来维护者能直接从失败 Check 找到领域 owner、独立重跑命令和完整诊断。
- 用原生执行与材料结算减少项目运行状态，只保留无法由通用文件变化或计算缓存代替的最近成功输入事务。

## 背景

- 前序以标签依赖图和成功 receipt 选择所有 base 工作，另有 release 批次及成功证明；这曾同时承担昂贵项目命令与原生材料的跨运行省略。
- 原生 command Check 已拥有进程生命周期、受限捕获、transcript 与独立终态，当前项目测试文件没有需要批次去重的重叠。批次结果投影和额外证明增加维护面，而既有测量不足以证明其收益值得继续保留。
- 批次退役直接改变[版本管理资源边界前序](isolate-release-version-control-resource-boundary.md)仍保留的机制；执行方式与资源隔离分别承接：
  - 唯一文件去重、worker、JUnit 投影与批次成功证明在独立命令体系中退出，不回挂到更早的间接批次祖先。
  - 版本管理独立诊断、CPU 独占和重评条件由同次[资源隔离后继](../retain-release-version-control-isolation.md)保留；本判断不把执行容器简化解释为解除隔离。
- 原生材料能够按完整磁盘选择和当前规则结算，并自行复用计算事实；项目命令仍可能读取 Git ignore 下的 fixtures、生成物、MTS、配置和外部环境。只比较 Git revision、路径邻近或缓存解析事实，不能证明这些项目命令已在当前完整输入下通过。
- Vibe 的 flags、依赖、learned strategy 和资源准入足以拥有运行选择与调度；项目需要补足的只是实际输入闭包与成功发布条件。

## 决策

- 采用: 原生材料每轮实际结算；外部项目命令按独立 `commandCheck` 接入，完整原始输出留在各自 transcript，machine 与进度只含安全摘要。Check 身份按证明契约和失败 owner 划分，不按执行容器或耗时划分；人工领域聚合入口继续保留。
- 采用: 只有已评审完整输入域的项目 Check 才可复用最近 passed receipt。项目声明显式 patterns，由原生 region 完成路径匹配；采集联合 Git 可见项和声明磁盘输入，覆盖源码、测试、ignored fixtures、生成运行时、manifest/lock、配置、必要工具链和环境。未知来源、symlink、读取或探测失败、预算不足均保守执行，不发布不完整证明。依赖字节服从受信 frozen-lock 安装前提，不把 receipt 当作安装目录防篡改证明。
- 采用: 指纹绑定稳定 Check ID、契约版本、完整选中内容及环境身份，精确匹配才可省略；文件未变化、旧成功记录或路径归属都不是单独充分条件。需执行项转为内部 flags，Vibe 保留完整 Definition 并负责依赖传播、selection、settlement 与严格有效 aggregate。复用项保持未激活状态；provider 被本次 consumer 带入时实际执行，不将跨运行证明冒充当前 dependency outcome。
- 采用: 只有最终 Run completed/passed 且需执行项目项全部通过，才重取同一输入域；起止完整身份一致后原子替换 receipt。取消、失败、rejection、output failure 或漂移不发布。证明 cache 不可用只增加执行，不能改变质量真值；原生计算事实和 learned history 分别按自身责任维护。
- 采用: release、CI 与显式 cold 全执行当前 profile 的适用检查，不采集、读取或发布项目 receipt。普通产品验证属于 base；只有 pending snapshot prepare、version authorization 与 packaging 为 release-only，三者以 typed handoff 传递同一个私有授权快照，machine 只保存摘要。
- 采用: 继续使用原生 learned helper、稳定可比较身份和可丢弃本地 history；身份覆盖任务、profile、实现契约、运行平台与资源容量。依赖、资源和质量真值由 Vibe 掌握，项目不建立另一套 runner 或 settlement。基础环境成功前置保持独立政策；版本管理 CPU 隔离由独立资源决策承接。
