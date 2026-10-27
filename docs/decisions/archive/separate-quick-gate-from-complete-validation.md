---
title: 分离快速 Gate 与完整验收并约束性能预算
id: 261022-separate-quick-gate-from-complete-validation
status: archived
alignment: aligned
createdAt: 2026-10-22T09:57:42Z
purpose: 让日常反馈快速可控，同时保留完整变更验收、可信证明与发布授权。
background: 默认完整检查混合反馈与验收责任；原生输入证明和调度可继续复用，快速入口需独立性能及授权边界。
decision: 默认 quick 执行必要范围并强制预算；changed 完成变更验收，CI/full/release 全执行，quick 不发布证明。
tags:
  - project-tooling
  - responsibility-boundaries
  - validation-boundaries
  - vibe-gate
relations:
  - type: 修订
    target: 261021-allow-markdown-lint-receipts
    summary: 保留原生执行和完整输入证明，分离快速范围、验收与性能门槛
---

## 目的

- 让日常反馈在明确的快速必要范围内获得可验证的速度承诺，同时保留完整变更验收与发布的可信依据。
- 保持唯一原生执行、结算和输入证明主线，使失败可归因、命令可独立重跑，完整诊断与安全摘要各归其位。

## 背景

- 前序将项目命令及完整输入已闭合的 Markdown 内容检查纳入精确 receipt，其他原生材料每轮结算。它解释了如何可靠减少重复工作，但默认完整 base 仍同时承担日常反馈与完成验收。
- Vibe 已拥有 command 生命周期、flags、成功依赖、learned 调度、资源与严格 aggregate。分离反馈范围无需另建 runner，也不能把未运行项或计算事实缓存冒充本轮通过。
- 快速入口有独立预算后，原生质量通过不再单独决定 CLI 成功。尤其 receipt 发布后的晚预算失败会使失败入口留下成功授权；快速入口只消费既有证明可以避开额外事务。
- Markdown 内容只消费完整所选 source 与规则，链接还需观察目标身份和 anchor；项目命令可能读取 ignored fixture、生成物、配置、工具链和环境。分层不缩减这些真实输入责任。

## 决策

### 反馈与验收责任

- 采用: 默认 quick 只选择固定必要 eligible 集，changed 承担完整 base 的变更相关验收，full/CI 实际执行全部 base，release 实际执行完整 catalog；稳定 `check:changed` 是完成验收入口，`all` 是其别名。quick 成功不能代替 changed 或 CI 全量。具体成员与命令参数由[项目工具链](../../tooling.md)承接。
- 采用: quick 的总墙钟严格低于 30s、本轮实际执行 Check 的 nearest-rank P90 严格低于 10s、均值严格低于 5s，任一达到或超过即失败。null 和复用项不补零，真实零保留，缺失/非法测量使 quick 失败；其他范围只报告、不设硬预算。单调时钟从 `runVibeCheck` 入口、输入采集前覆盖至业务收尾（含 changed receipt 发布），在性能报告前采样；quick 初判通过时在报告后末次采样，超限只补写一次失败报告。末次采样后的打印、最终落盘和 return，以及函数前模块加载、父 Bun 启动均不计入，不承诺强制超时终止。
- 采用: 原生 output failure 在所有范围阻断；项目附加性能 summary 写入不可用时仅 quick 失败，其余范围 warning，不改变质量结论或 changed 的 receipt 成功事务。性能政策与原生质量结论合取控制退出，不重写原生 settlement。
- 采用: quick 可以消费既有完整精确证明，但不发布或清除 receipt；changed 保留成功发布事务。只有最终 Run completed/passed、需执行项全部通过且起止完整输入身份一致，才原子发布 changed 证明；失败、取消、rejection、原生 output failure 或漂移不发布。漂移只拒绝发布，不额外改变原生结算；cache 不可用只扩大本次有效范围内的执行。

### 原生执行与可信证明

- 采用: 外部命令保持独立原生 `commandCheck`、精确 argv、直接失败 owner 和独立重跑入口；原始输出留在 transcript，machine/progress 仅保存安全摘要。身份按证明契约与责任划分，不按耗时或执行容器拆分。Vibe 保留完整 Definition 并负责 selection、依赖传播、资源与严格 aggregate。
- 采用: 只有已评审完整输入闭包的项目命令与 Markdown 内容 Check 可复用 receipt。指纹绑定稳定 Check ID、契约版本、完整选集、selection/规则/limits/policy、构造配置及必要工具链和环境；源码、ignored 输入、生成物、manifest/lock 均按真实消费纳入，完整 Markdown 磁盘选集不受 Git ignore 省略。CLI 在采集和子进程前按平台分隔符对真实 PATH 精确去重、保留首次顺序，避免入口嵌套产生重复环境条目；子进程与证明共用规范化结果，不扩大环境排除。原生 region 匹配显式 patterns，采集联合 Git 可见项与声明磁盘输入；未知、symlink、读取/探测失败或采集预算不足保守执行且不发布部分证明。依赖字节继续服从受信 frozen-lock 安装前提。
- 采用: 工具能力变化和 Check 订阅继续由独立判断承接。完整 Check 及订阅能力指纹精确匹配才形成复用候选，原生 flags 承担选择；复用项保持未激活，不冒充本轮 passed。共享 flag 带入的订阅者和 consumer 带入的 provider 如实执行，成功前置不以跨 Run receipt 伪造。
- 采用: 完整 changed/full/release 范围中，除 Markdown 内容的精确 receipt 例外外，原生材料每轮按当前材料与规则结算；quick 只承担其 eligible 范围。Markdown 链接在适用范围中本次观察目标；原生计算事实 cache 与成功 receipt 分责，learned history 仅影响可丢弃的调度偏好。

### 发布与调度边界

- 采用: release/CI/full 不采集、读取或发布 receipt；release tag、兼容 `--full`、显式 cold 与同快照授权打包保持。只有 pending snapshot prepare、version authorization 和 packaging 为 release-only，三者以 typed handoff 传递同一私有快照，machine 只保存摘要。
- 采用: 继续使用原生 learned helper、稳定可比较身份和本地可丢弃 history，身份覆盖任务、有效 profile、实现契约、平台与资源容量。依赖、硬资源和质量真值保持原生责任；版本管理 CPU 隔离继续由独立资源决策承接。
