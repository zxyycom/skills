---
title: 选择性发布调查 candidates，并保留全量正式同步
status: active
alignment: aligned
createdAt: 2026-09-02T07:21:12Z
purpose: 让通过审核的调查 candidate 以显式选择和可重复预检正常建立，并保持正式 Markdown 为唯一事实源。
background: 报告级索引从完整正式集合重建；candidate workspace 不能把未选择内容或手工正式来源漂移混入正常建立。
decision: publish 只建立通过当前正式基线完整预检的显式 candidates 并发布最终索引；sync-index 保留全量恢复和接纳职责。
tags:
  - investigation-report
relations:
  - type: 修订
    target: maintain-report-level-investigation-index.md
---

## 目的

- 让一个或多个完成审核的 candidate 可以先只读预演最终正式集合，再按显式选择事务化建立。
- 防止正常建立动作吸收未选择 candidate、陈旧索引或手工正式来源漂移。
- 继续让 report-level index 只从正式 Markdown 产生，不成为 candidate 或资源内容的第二事实源。

## 背景

- 报告级索引已经以 Investigation ID 投影 title、formedAt、question、tags、关系和资源引用，并从全部正式 Markdown 重建。
- 手工正式创建、批量修正和索引恢复仍需要一个全量接纳入口；将它们混入正常 candidate publish 会让意外来源和显式选择失去边界。
- candidate 的资源位置与正式报告相同，且资源字节不属于索引 source revision，因此 publish 不能把资源搬迁或字节变化误作索引漂移。

## 决策

- 采用: `publish <investigation-id...> --preflight` 只读构造当前正式基线与显式 selected candidates 的最终关系图、资源验证和规范索引；它不保存 receipt、确认或写入状态。
- 采用: 普通 `publish` 在集合 lock 内重新读取和预检，只以不覆盖改名建立 selected candidates，并以最终正式索引为提交点。未选择 candidate、资源和无关工作保持不变。
- 采用: 正式报告非空时 publish 要求持久索引结构有效且对全部正式 Markdown 新鲜；空集合只接受合法空索引，或在无报告且无索引时首次建立。手工正式来源、缺失、损坏或陈旧基线先由 `sync-index` 显式处理。
- 采用: `sync-index` 继续忽略合法 candidate，并从全部正式报告全量验证、恢复索引和接纳手工正式来源变化；publish 是正常候选入口，不是正式报告形式上的唯一建立动作。
- 采用: 索引仍只投影正式报告；candidate、资源成员、名称和字节不进入 source revision。publish 检查 selected candidate 的资源路径、owner、引用与成员安全，但不改写、搬迁或暂存资源。
- 不采用: 让 publish 全量扫描并接纳所有 candidate 或手工正式报告、依赖 preflight receipt、双写 candidate index，或用资源字节推动报告索引新鲜度。
