---
status: active
alignment: aligned
createdAt: 2026-07-03T10:58:54+08:00
---

# 迁移为 skills 单仓库布局

## 索引摘要
- 目的: 简化个人维护的多 skill 仓库结构，并统一共享工具链和交付。
- 背景: 仓库原来通过 Git submodule 组织多个 skill 子仓库, 但当前项目是个人自用和个人维护, 没有外部使用者依赖子仓库的独立 release 入口。
- 决策: 用 `skills/<skill-name>/` 直接承接所有实际可打包 skill, 每个一级目录必须包含 `SKILL.md`。

## 目的
- 简化个人维护的多 skill 仓库结构，并统一共享工具链和交付。

## 背景
- 仓库原来通过 Git submodule 组织多个 skill 子仓库, 但当前项目是个人自用和个人维护, 没有外部使用者依赖子仓库的独立 release 入口。
- Submodule 让日常维护必须同时处理子仓库状态、主仓库指针、独立发布 workflow 和聚合发布入口, 对当前维护规模来说成本大于收益。
- 迁移时仍希望保留各子仓库已有 README 和文件历史, 不能简单复制当前文件后丢失来源脉络。

- 根目录 `skills` 仍是项目仓库名; 实际可分发 skill 需要集中放入仓库内的 `skills/` 目录, 避免和项目级文档、脚本、CI 混在根目录。
- 原子仓库 README 是面向人类的 skill 介绍页, 不是 agent 执行时必须读取的 skill 本体。
- 当前仍需要主仓库统一校验、打包、hash 门禁、updater 生成和版本化 release。

1. 先判断是否继续保留多仓库: 如果子仓库独立安装、独立发布和独立维护不是核心价值, submodule 带来的状态同步成本不值得保留。
2. 再判断单仓库形态: 不采用根目录直接平铺 skill, 而是在项目根目录下新增 `skills/` 集中承接实际 skill。
3. 最后处理 README 和历史: README 作为人类介绍页迁入 `docs/skills/`, 子仓库历史通过 subtree 导入后再移动到最终路径, 让最终结构干净且可用 `git log --follow` 追溯。

## 决策
- 采用: 用 `skills/<skill-name>/` 直接承接所有实际可打包 skill, 每个一级目录必须包含 `SKILL.md`。
- 采用: 用 `docs/skills/` 承接原子仓库 README 和后续面向人类的 skill 介绍页。
- 采用: 删除 `.gitmodules`、submodule 指针、子仓库独立 release workflow、子仓库 hook 和子仓库 hash 基线。
- 采用: 主仓库脚本直接扫描 `skills/` 发现 skill, updater source path 指向 `zxyycom/skills` 的 `skills/<skill-name>/`。
- 采用: `skill-package-lock.json` 作为聚合 release 门禁和单 skill hash manifest, 但 hash 计算读取主仓库 Git index 中 `skills/` 下的 blob。
- 采用: 只保留主仓库聚合版本化 release 和 `skills-latest` 兼容入口。
- 不采用: 保留 `子仓库/skill/<skill-name>/` 的二级仓库形态; 这会把 submodule 迁移成普通目录, 但仍留下旧 owner 边界。
- 不采用: 把 skill 直接平铺在项目根目录; 这会让 skill 本体和项目级维护文件混在一起。

## 关系
- 修订: [使用 latest release 自动发布 skill 制品](260630-publish-skill-package-as-latest-release.md)
- 修订: [使用 skill hash 门禁 latest release 发布](260701-gate-latest-release-by-skill-hash.md)
- 修订: [使用版本化 release 发布 skill 制品](260701-publish-versioned-skill-releases.md)
- 修订: [在 skill 包内分发自更新脚本](260701-embed-self-update-script-in-skill-packages.md)
- 修订: [用 Git hook 更新 package hash](260701-update-package-hash-with-git-hooks.md)
- 替代: [给子仓库增加独立 release workflow](260701-add-submodule-release-workflows.md)
