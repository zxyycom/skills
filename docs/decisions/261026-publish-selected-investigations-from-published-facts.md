---
title: 从发布事实选择性建立调查候选
id: 261026-publish-selected-investigations-from-published-facts
status: active
alignment: aligned
createdAt: 2026-10-26T08:33:54Z
purpose: 让审核完成的显式候选正常建立，隔离无关来源并保持Markdown事实源和全量恢复职责。
background: 全部正式Markdown新鲜曾是旧门槛；局部发布已采用，但不能让候选建立、资源与全量接纳义务随之丢失。
decision: publish读取合法发布基线和所选候选及直接资源，锁内重做后无覆盖建立并发布索引；全量sync独立接纳与恢复。
tags:
  - investigation-report
  - product-architecture-judgment
  - responsibility-boundaries
  - source-artifact-separation
relations:
  - type: 修订
    target: publish-investigation-candidates-selectively
    summary: 保留显式候选发布，改用发布基线和局部来源验收
---

## 目的

- 保持候选审核、正式建立与全量来源接纳的边界，不混入未选择工作。

## 背景

- 报告级索引投影正式 Markdown；资源在最终 owner 路径，资源字节不属于 source revision。
- 自 Git `f119d834` 采用局部发布后，又采用按发布事实验收的方向；本判断据此统一候选发布门槛，保留候选建立、资源保护和全量接纳的完整责任。

## 决策

### 显式选择与发布基线

- 采用: 完成所选候选正文、真实直接关系与必要资源后，独立审核内容和建立授权。`publish` 只处理显式选择；target 来自合法正式基线或同批选中候选，未选候选不参与闭合。
- 采用: 读取结构与完整领域图合法的发布基线，核对所选候选与直接资源。
  - 前序和其他正式 owner 声明由发布索引提供，不另读纯索引依赖正文。
  - 已有合法空索引可用；正式报告与索引均不存在时可首次建立。
  - 坏、缺失或不兼容基线，以及已知合法手改，先显式恢复或同步；不自动接纳未知正式来源。

### 预检、提交与独立验收

- 采用: `--preflight` 只读预演本次完整选择的最终图、资源条件和规范索引，不保存 receipt 或确认，也不作为写凭据。
- 采用: 正式 `publish` 在集合锁内重新读取验证，以不覆盖改名建立所选报告并发布最终完整索引。
- 采用: 正式 `publish` 以实际索引发布为提交点，之后还须独立验收实际写集 bytes、identity、mode 及相关事实。
  - 提交前失败按完整恢复证明处理。
  - 提交后不自动回滚，验收与清理按结果契约分别诊断。

### 资源边界与全量接纳

- 采用: 未选候选、资源和无关工作保持不变。
  - 资源路径、owner、引用、成员安全与可见性在发布前核对，不移动、改写或暂存资源。
  - 资源字节变化不推动报告索引 revision，候选也不进入正式 revision。
- 采用: 全量 `sync-index` 从正式 Markdown 验证或恢复投影，并接纳合法手工正式来源；合法候选留在正式索引外，不建立 candidate index。
  - `publish` 是正常候选入口，不是唯一形式建立动作；它不自动扫描并接纳全部候选或手工正式报告。
  - 任务要求全集健康时在批末严格 `check`，局部成功不冒充全集事实。
