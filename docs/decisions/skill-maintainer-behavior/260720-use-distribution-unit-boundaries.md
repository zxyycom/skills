---
title: 以分发单元定义 skill 的独立交付边界
status: active
alignment: aligned
createdAt: 2026-07-20T10:15:58+08:00
purpose: 让单个 skill 和成套 skills 都能按真实安装与使用方式维护, 同时阻止跨分发单元的隐含依赖。
background: Skill 是行为入口，分发单元才是安装和交付边界；要求每个 skill 单独交付会破坏合法的单元内依赖。
decision: "`skill-maintainer` 区分 skill 行为单元与 distribution unit 交付单元, 允许同一单元内显式依赖和交接, 并要求跨单元依赖声明前置条件及缺失路径。"
relations:
  - type: 修订
    target: skill-maintainer-behavior/260719-own-project-aware-skill-lifecycle.md
  - type: 判定无效
    target: skill-maintainer-behavior/260720-define-skills-by-self-contained-contracts.md
---

## 目的
- 让 skill 的行为契约按单个入口维护, 让安装、更新、兼容性和完整验收按真实分发单元维护。
- 允许一组本来就不承诺单独使用的 skills 共同完成工作流, 不为形式上的单 skill 独立性拆散依赖。
- 让每个分发单元在没有其他未声明单元时仍能完成自身承诺, 或明确表达外部依赖缺失后的失败或降级路径。
- 保留 `skill-maintainer` 对不同维护环境的适配能力和单 skill 结构验证入口。

## 背景
- Skill 的 `name`、`description`、正文和按需资源共同形成一个可触发的行为单元。
- 安装和使用并不总以单个 skill 为边界: 有些分发单元只包含一个 skill, 有些分发单元包含一组按阶段协作且不打算单独使用的 skills。
- 在当前项目中, `prompt-optimize` 独立组成一个分发单元; `openspec-explore`、`openspec-propose`、`openspec-apply-change` 和 `openspec-archive-change` 共同组成一个分发单元。
- 同一分发单元的成员可以合法地互相点名、依赖、传递状态和指定交接, 因为安装契约保证它们共同存在。
- 其他分发单元的存在不由当前单元控制; 未声明地调用外部成员会让安装组合改变行为。
- 先前决定把每个分发后的 skill 都视为必须独立工作的最小交付, 混淆了行为单元和分发单元。
- 当前仓库打包器仍按单个 `skills/<skill-name>/` 输出 zip, 尚未表达 OpenSpec 四个 skills 的单元级安装和更新边界, 因此不能用现有物理包结构反推行为上的分发单元。
- 现有 `validate-skill.mjs` 只验证单个 skill 的结构, 不能推断分发单元或证明跨 skill 依赖完整。

## 决策
- 采用: `skill-maintainer` 继续承接 skill 模型、能力归属、行为契约、资源结构和完成验收, 并增加分发单元的识别与交付边界。
- 采用: Skill 是行为单元; 每个 skill 仍拥有独立的发现入口和触发后行为契约。
- 采用: Distribution unit 是安装、更新、版本兼容、成员完整性和交付验收的边界, 可以包含一个或多个 skill 及其运行所需资源; 环境集成配置用于声明、构建或验证单元, 不要求进入分发内容。
- 采用: 分发单元边界优先从用户说明和当前环境的安装、更新、metadata、打包或发布契约恢复; 位于同一仓库或主题相近不自动形成同一单元。
- 采用: 同一分发单元内的成员可以显式点名、调用和依赖, 但需要写清触发条件、交接输入和完成状态。
- 采用: 跨分发单元的依赖不能作为未声明前提; 确有依赖时写成显式前置条件, 并定义缺失时的失败或降级路径。
- 采用: 以分发单元而不是单个 skill 承接“自包含最小基线加环境适配”; 单元必须包含兑现整体契约需要的全部成员和资源。
- 采用: `scripts/validate-skill.mjs` 继续机械检查每个 skill 的通用结构; 分发单元成员、内部依赖、共享资源、metadata、打包和安装契约由当前环境的验证入口补充, 没有机械入口时报告人工证据和残余风险。
- 采用: 安装、启停、发布、提交和全局配置变更继续作为用户明确授权的外部状态变更。
