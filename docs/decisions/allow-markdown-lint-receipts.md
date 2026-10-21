---
title: 以完整输入证明复用 Markdown 内容检查
id: 261021-allow-markdown-lint-receipts
status: active
alignment: aligned
createdAt: 2026-10-21T07:14:01Z
purpose: 保持全仓验证语义，同时让输入完全相同的 Markdown 内容检查复用成功证明。
background: 原生内容检查已有计算事实缓存；完整磁盘选集可纳入现有 receipt 事务，链接仍需本次目标观察。
decision: 保持原生执行与发布事务，仅将已闭合输入的 Markdown 内容检查纳入精确 receipt 复用。
tags:
  - project-tooling
  - responsibility-boundaries
  - vibe-gate
relations:
  - type: 修订
    target: 261020-native-gate-execution-and-project-receipts
    summary: 保留执行与发布边界，仅扩入完整输入已闭合的 Markdown 内容检查
---

## 目的

- 保持唯一可信的 Gate 结论，失败 Check 可直接定位领域 owner、独立重跑命令与完整诊断。
- 保留原生执行和材料结算，以完整输入成功事务省略已验证且未变化的检查，不把计算事实缓存等同全仓验证证明。

## 背景

- 独立原生 command Check 已承担进程生命周期、受限捕获、transcript 与终态；Vibe 的 flags、依赖、learned strategy 和资源准入继续承担选择、调度与结算。
- 原生 Markdown 内容检查只消费所选文档及规则配置。将完整磁盘选集和真实配置纳入既有指纹后，可以用同等级成功证明省略本次执行。根目录和额外目录中的 Git ignored Markdown 也可能属于原生选集，不能只采集 Git 可见项；逐文件计算事实缓存也不保存完整 Check 的 passed outcome。
- Markdown 链接还消费直接目标存在性、kind、symlink 与 anchor，本次仍需观察这些目标；其他原生材料保持每轮结算。项目命令仍可能读取 ignored fixtures、生成物、MTS、配置、工具链和环境，完整输入要求不变。

## 决策

- 采用: 外部项目命令按独立 `commandCheck` 接入，完整原始输出留在各自 transcript，machine 与进度只含安全摘要。Check 身份按证明契约和失败 owner 划分，不按执行容器或耗时划分；人工领域聚合入口继续保留。除以下 Markdown 内容例外外，原生材料每轮实际结算，基础环境成功前置保持每轮执行。
- 采用: 只有已评审完整输入域的项目命令与 Markdown 内容 Check 可复用最近 passed receipt。Markdown 内容证明覆盖与原生一致的完整磁盘 source 集合及 path/kind/mode/bytes、selection、规则、limits/policy、构造配置实现、manifest/lock 与必要工具链身份；选集不受 Git ignore 省略。沿用同一能力声明、快照与 receipt 事务，保持完整 Check 身份，原生 condition 承担选择；Markdown 链接保持每轮执行。
- 采用: 项目声明显式 patterns，由原生 region 完成路径匹配；采集联合 Git 可见项和声明磁盘输入，覆盖源码、测试、ignored fixtures、生成运行时、manifest/lock、配置、必要工具链和环境。未知来源、symlink、读取或探测失败、预算不足均保守执行，不发布不完整证明。依赖字节服从受信 frozen-lock 安装前提，不把 receipt 当作安装目录防篡改证明。
- 采用: 指纹绑定稳定 Check ID、契约版本、完整选中内容及环境身份，精确匹配才可省略；文件未变化、旧成功记录或路径归属都不是单独充分条件。需执行项转为内部 flags，Vibe 保留完整 Definition 并负责依赖传播、selection、settlement 与严格有效 aggregate。复用项保持未激活状态；provider 被本次 consumer 带入时实际执行，不将跨运行证明冒充当前 dependency outcome。
- 采用: 只有最终 Run completed/passed 且需执行项全部通过，才重取同一输入域；起止完整身份一致后原子替换 receipt。取消、失败、rejection、output failure 或漂移不发布；漂移拒绝发布不额外改变本次 Gate 的结算结果。证明 cache 不可用只增加执行，不能改变质量真值；原生计算事实和 learned history 分别按自身责任维护。
- 采用: release、CI 与显式 cold 全执行当前 profile 的适用检查，不采集、读取或发布 receipt。普通产品验证属于 base；只有 pending snapshot prepare、version authorization 与 packaging 为 release-only，三者以 typed handoff 传递同一个私有授权快照，machine 只保存摘要。
- 采用: 继续使用原生 learned helper、稳定可比较身份和可丢弃本地 history；身份覆盖任务、profile、实现契约、运行平台与资源容量。依赖、资源和质量真值由 Vibe 掌握，项目不建立另一套 runner 或 settlement。版本管理 CPU 隔离由独立资源决策承接。
