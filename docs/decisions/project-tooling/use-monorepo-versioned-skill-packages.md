---
title: 用单仓库维护带独立版本的 skill 包
status: active
alignment: aligned
createdAt: 2026-07-24T05:56:25Z
purpose: 集中维护和发布多个 skill，同时保留每个 skill 独立判断更新的版本边界。
background: 子仓库和持久化 package lock 都会增加当前个人维护仓库的状态同步成本。
decision: 在 `skills/` 维护带手动 `metadata.version` 的独立包，聚合发布，hash 仅按需临时计算。
relations:
  - type: 修订
    target: project-tooling/260702-use-monorepo-skills-directory.md
---

## 目的
- 用一个仓库统一维护多个 skill、共享工具链和聚合发布流程。
- 让每个 skill 拥有独立版本，使 updater 不受其他 skill 发布和本地定制影响。

## 背景
- 当前项目由个人维护，不需要各 skill 通过子仓库独立安装、维护和发布；submodule 的状态同步成本大于收益。
- skill 本体、面向人类的说明和项目级工具链需要分开承接，但 release 仍适合一次发布全部正式制品。
- Git 已经保存内容历史，`SKILL.md` 中的独立版本已经保存更新语义；继续跟踪 package lock 会形成额外的派生状态。

## 决策
- 采用: `skills/<skill-name>/` 直接承接可打包 skill，每个 `SKILL.md` frontmatter 必须包含手动维护的正整数字符串 `metadata.version`。
- 采用: `docs/skills/` 承接面向人类的 skill 介绍，项目级文档、脚本、工具源码、CI 和配置留在根目录相应 owner。
- 采用: 主仓库脚本扫描 `skills/`，为每个 skill 生成独立 zip 和版本 manifest，并通过一个聚合 release 发布完整资产集。
- 采用: updater 依据对应 skill 的独立版本判断更新；一个 skill 的变化不改变其他 skill 的版本。
- 采用: package hash 只从待提交或待发布快照按需临时计算，用于标识本次制品；仓库不保存 package hash 或 lock 文件。
- 不采用: 恢复 submodule、子仓库独立 release，或把 skill 本体直接平铺到项目根目录。
