---
title: 将 OpenSpec 四阶段组成聚合分发单元
status: active
alignment: aligned
createdAt: 2026-08-11T04:03:15Z
purpose: 让四个阶段以一个聚合分发契约协同交付，同时保持成员制品、版本、更新与选择安装独立。
background: 共同分发单元描述成员协作与交付关系，并不要求合并为单个物理包或让全部成员成为强制安装集合。
decision: 四个 OpenSpec skill 共同组成聚合分发单元；每个成员仍有独立制品、版本和 updater，支持按需安装。
tags:
  - openspec
  - skill-maintainer
relations:
  - type: 修订
    target: distribute-openspec-skills-independently.md
---

## 目的

- 让 `openspec-explore`、`openspec-propose`、`openspec-apply-change` 和 `openspec-archive-change` 以一个明确的 OpenSpec 聚合分发单元表达共同生命周期和交付关系。
- 让使用者仍可按需选择成员，并让每个成员的物理制品、版本和更新保持可独立维护。

## 背景

- 四个 skill 围绕同一个 OpenSpec change 生命周期协作，阶段交接依赖共同的 CLI 与持久 artifacts，适合由一个聚合契约说明成员集合和工作流关系。
- 聚合分发单元是逻辑交付边界，不等于单一 ZIP、单一版本或必须完整安装的物理包；成员仍可拥有各自的行为入口和交付节奏。
- 主仓库已经能够分别生成 skill 制品并从同一聚合入口提供获取；更强的 OpenSpec 局部关系不需要扩大通用分发为完整安装集合管理器。

## 决策

- 采用: 四个 OpenSpec skill 共同构成一个聚合分发单元；聚合层拥有成员清单、共同生命周期定位及必要的工作流或兼容交付说明。
- 采用: 每个成员继续拥有自己的 skill 身份、版本、制品、updater、结构校验和行为结果；聚合关系不把这些物理交付物合并为单个包。
- 采用: 使用者可以只安装或更新所选成员。未安装成员不会仅因属于同一聚合单元就成为隐含运行前提；真实跨 skill 前置必须由对应行为 owner 显式声明。
- 采用: 聚合发布或 manifest 可以协调成员发现、组合说明和兼容信息，但不要求成员锁步版本、同步更新或强制全量安装。
- 采用: OpenSpec 阶段继续通过 CLI 状态、持久 artifacts 和显式用户选择交接；聚合单元不建立进程内调用或隐式成员可用性保证。
- 不采用: 把四个成员描述为四个彼此无关的分发单元，或把一个聚合分发单元等同于一个物理 package。
