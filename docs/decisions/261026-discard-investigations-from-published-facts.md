---
title: 按发布事实安全删除调查并区分提交边界
id: 261026-discard-investigations-from-published-facts
status: active
alignment: aligned
createdAt: 2026-10-26T08:38:31Z
purpose: 让获准删除的完整报告或候选安全退出，准确区分提交、验收和残留清理。
background: 裸删会破坏关系和owner；正式与候选删除各有提交边界，高风险局部维护仍需完整写集与资源保护。
decision: discard按发布事实和实际删除范围局部验收；正式删除在索引发布时提交，候选删除在对象退出时提交，验收与清理分别对账。
tags:
  - investigation-report
  - product-architecture-judgment
  - transactional-updates
  - version-control
relations:
  - type: 修订
    target: discard-complete-unreferenced-investigation-reports
    summary: 保留安全显式删除和正式索引提交，按发布事实局部验收
---

## 目的

- 只在精确授权内删除应退出的完整记录，不以归档或关系冒充删除。

## 背景

- 删除图、资源归属与Git确认各有风险；当前责任已从全集来源验收改为发布事实和实际影响范围。

## 决策

### 删除对象与资源保护

- 采用: `discard` 按稳定 ID 选择完整合法候选或正式报告。
  - 正式目标不得有发布索引可见的剩余关系引用，移除后的完整组合图及拆分闭包必须合法。
  - 发布索引、所选来源和明确 owner 树有效；已知合法所选手改先同步，不以无关正文健康作门槛。
- 采用: 自有资源必须显式使用 `--delete-owned-resources`。
  - 索引中其他正式报告仍引用时，先独立迁移 owner 或更新引用；不在同次删除中自动修改关系或转移归属。
  - 未选候选引用不自动检查或修复，未来发布时诊断。
- 采用: owner 树仅含安全、可见、非 symlink 的普通受管成员；ignored、不安全、非普通、无法完整检查或漂移的成员阻断递归删除。准备与写前保护实际删除范围和资源身份。

### 历史确认与事务提交

- 采用: 目标或任一将删资源进入 HEAD 时，首次无 `--delete-recorded` 调用零写暂停；参数只在覆盖精确目标与影响的授权内使用。
  - 非 Git 或 unborn HEAD 无额外门禁；本动作必要的 Git/HEAD 核对异常时零写停止。
  - `--delete-recorded` 只确认删除已记录历史，不免除必要历史读取或资源安全检查。
- 采用: 删除通过与其他维护共用集合锁的事务执行，不裸删；以同文件系统 tombstone 及索引发布保护可恢复写集。
  - 正式报告删除以实际索引发布为提交点；末条正式删除保留合法空索引。
  - 候选删除不制造或改写正式索引，以对象退出受管集合为提交点。
  - pending 保持不变。

### 验收、恢复与清理

- 采用: 成功须独立验收实际 bytes、identity、mode 及相关来源和成员。
  - 越过本动作适用提交点前的失败，仅在完整旧范围恢复得到证明后报告 `rolled-back`。
  - 一旦越过该提交点，不自动回滚；验收失败或未知报告 `partial-or-unknown`。
  - 验收通过、仅清理或解锁未完时报告 `committed-cleanup-pending`。
  - 非零不等于未删除；先对账实际路径和残留，再决定后续，不因清理残留直接重做删除。
