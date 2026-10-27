---
title: 以快速基线和显式范围完成日常验证
id: 261027-prefer-explicit-local-gate-scopes
status: active
alignment: aligned
createdAt: 2026-10-27T09:10:40Z
purpose: 让本地验证按任务责任选择，避免其他工作区改动扩大执行，同时保留完整验收与发布兜底。
background: 强制 changed 验收、全域输入采集及统一生成阻断使局部任务承担无关验证成本。
decision: 默认 quick，显式能力 scope 追加检查与必要前置；自动 changed 和全量发布作为独立兜底。
tags:
  - project-tooling
  - responsibility-boundaries
  - validation-boundaries
  - vibe-gate
relations:
  - type: 修订
    target: 261022-separate-quick-gate-from-complete-validation
    summary: 以任务显式范围替代每次维护必须完整changed
  - type: 修订
    target: 261020-unify-gate-generated-artifact-prerequisite
    summary: 显式模式限定生成consumer的真实skill闭包
---

## 目的

- 让日常维护按本任务的证明责任取得必要证据，不因其他人员或会话的工作区变更被迫运行无关检查。
- 保留统一原生 Gate、真实成功前置与可信失败边界；完整变更、CI 和发布继续拥有独立兜底责任。

## 背景

- 前序以固定 quick 和强制 changed 验收区分反馈与完成，并以一个全 skill 生成 provider 建立分发信任。两项判断保留了完整证据，但把日常局部任务绑定到了全工作区采集和共同阻断。
- 用户选择默认 quick，再显式追加本任务相关检查；自动变化判断不等于改动归属。仅给现有自动流程增加 flag 而仍先采集全域输入或校验所有 skill，不能落实这个边界。
- 现有能力订阅、Vibe flags 与成功依赖已能组合所选检查，无需第二份检查清单或调度器。收窄执行范围不代表删除所选检查真实读取的共享输入。

## 决策

- 采用: 日常验证由固定 quick 基线和任务显式能力组组成。重复 `--scope` 取并集，追加实际订阅的 Check 及传递成功前置；未知值或模式冲突在执行前拒绝。复用现有能力声明与原生选择机制，避免维护第二份清单或调度器。
- 采用: quick 与显式选组直接执行，不采集全工作区指纹，也不读写或删除项目 receipt。选择以任务责任为依据，检查仍读取自身真实输入；其他工作区变更不自动扩大范围。结果说明所选、实际执行及被前置阻断的对象，局部成功只证明局部范围。
- 采用: changed 与 `all` 保留自动变更验收，供影响不明或需要全工作区结论时兜底；full/CI 全部执行 base，CI 不受手选范围缩窄。release 全量检查后，从同一次 pending snapshot 完成 prepare、版本授权和打包，只有这三个交付事务为 release-only；私有快照及公开安全摘要边界保持。
- 采用: 统一生成 provider 与原生成功依赖保留。显式模式在加载适配器前合并并验证消费者的真实 skill 集合，再检查所选领域、updater、共享模块、manifest/lock、过期受管路径及附属物。越界、遗漏或所选及共同输入漂移失败；全域生成能力及 changed/full/release 继续联合检查。消费者等待本次 provider 实际通过，局部结果不产生全域复用凭据；领域直接校验、同步和回归入口继续保留。
- 采用: 生成适配变化须证明统一入口与领域生成义务等价；仅独立产品契约或新增输入责任增加 Gate 结果。所有模式保持完整 Definition，使用原生条件、依赖、资源与严格 aggregate 结算。命令保留精确参数、独立重跑入口和完整 transcript，公开输出只含安全摘要，未执行与复用不冒充本轮 passed。
- 采用: 只有 changed 复用或原子发布完整输入证明。Check 身份、契约、配置、选集、全部实际输入与环境须精确匹配；最终整轮及全部实际执行项通过、起止身份无漂移才发布。未知、symlink、读取或探测失败、采集不足、取消、rejection 和原生输出失败均拒绝部分证明；漂移只阻止发布，缓存不可用只扩大 changed 内执行。依赖以可信 frozen-lock 安装为前提，PATH 在采集与子进程前按平台分隔符去重、保持首次顺序。精确事务由[输入证明政策](../gate-policy.md#项目输入与成功证明)承接。
- 采用: quick 保留 total < 30s、nearest-rank P90 < 10s、mean < 5s 的硬预算，其他模式只报告。测量覆盖入口到业务收尾及 quick 报告后末次采样；空或非法测量失败，未执行或复用不补零，真实零保留，末次超限只补一次失败报告。入口前模块加载及末次采样后的输出不计入，不承诺强制超时。性能与质量共同决定退出；附加性能报告不可用仅使 quick 失败，原生输出失败在所有模式阻断。精确口径由[性能政策](../gate-policy.md#性能报告与快速预算)承接。
- 采用: 原生材料按适用范围每轮结算，changed 保留 Markdown 内容的精确证明例外，链接仍验证当前目标。计算缓存与成功证明分责，调度历史只影响偏好，保持硬资源与版本管理 CPU 隔离。调度身份按任务、有效 profile、实现契约、平台及容量稳定可比较，维护方法见[接入契约](../gate-check-authoring.md#关系资源与私有交接)。
