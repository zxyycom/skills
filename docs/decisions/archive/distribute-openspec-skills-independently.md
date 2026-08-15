---
title: 将四个 OpenSpec Skill 作为独立分发单元
status: archived
alignment: aligned
createdAt: 2026-08-11T03:24:20Z
purpose: 让 OpenSpec 各阶段能力可以分别选择、安装、更新和演进，而不把共同工作流误作成员共存保证。
background: 四个 skill 围绕同一 OpenSpec 生命周期协作，但各自拥有入口、版本、制品和 updater，且没有组合安装契约。
decision: OpenSpec explore、propose、apply 和 archive 分别构成独立分发单元，阶段关系不产生隐含跨 skill 依赖。
tags:
  - skill-maintainer
relations:
  - type: 拆分
    target: 260720-use-distribution-unit-boundaries.md
---

## 目的

- 让使用者只安装或启用所需的 OpenSpec 阶段能力，并让每个成员按自身承诺独立版本化和交付。
- 保留基于 OpenSpec artifacts 与 CLI 的阶段衔接，同时避免把其他 OpenSpec skill 当成隐含运行前提。

## 背景

- `openspec-explore`、`openspec-propose`、`openspec-apply-change` 和 `openspec-archive-change` 服务同一 change 生命周期，但各自具有独立触发场景和完成出口。
- 共同主题和顺序衔接不能证明安装系统会共同提供所有成员；只有组合安装、更新、兼容和成员校验契约才能形成多 skill 分发单元。
- 通过 OpenSpec CLI 与 change artifacts 交接，不要求负责前一或后一阶段的 skill 同时存在。

## 决策

- 采用: 四个 OpenSpec skill 分别构成独立分发单元，各自拥有独立身份、版本、制品、updater、结构校验和交付结果。
- 采用: 每个成员只按自身入口、OpenSpec CLI 前置条件和目标 change artifacts 定义行为，不假定另外三个 skill 已安装或可调用。
- 采用: 阶段之间通过 OpenSpec 的持久 artifacts、CLI 状态和显式用户选择交接；共同工作流不改变各成员的独立安装与更新边界。
- 采用: 若未来需要组合安装、锁步兼容或成员完整性保证，应先建立明确的组合分发契约和验证入口，再独立修订本判断。
- 不采用: 仅因四个能力覆盖连续阶段，就把它们视为一个已经得到安装契约保证的复合分发单元。
