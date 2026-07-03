# 2026-07-02 - 迁移为 skills 单仓库布局

## 状态
- 当前状态: active
- 导致状态变化的决策: 无
- 状态说明: 作为当前目录边界、skill 发现、聚合发布和历史迁移后的维护依据。

## 问题
- 仓库原来通过 Git submodule 组织多个 skill 子仓库, 但当前项目是个人自用和个人维护, 没有外部使用者依赖子仓库的独立 release 入口。
- Submodule 让日常维护必须同时处理子仓库状态、主仓库指针、独立发布 workflow 和聚合发布入口, 对当前维护规模来说成本大于收益。
- 迁移时仍希望保留各子仓库已有 README 和文件历史, 不能简单复制当前文件后丢失来源脉络。

## 背景与约束
- 根目录 `skills` 仍是项目仓库名; 实际可分发 skill 需要集中放入仓库内的 `skills/` 目录, 避免和项目级文档、脚本、CI 混在根目录。
- 原子仓库 README 是面向人类的 skill 介绍页, 不是 agent 执行时必须读取的 skill 本体。
- 当前仍需要主仓库统一校验、打包、hash 门禁、updater 生成和版本化 release。

## 决策过程
1. 先判断是否继续保留多仓库: 如果子仓库独立安装、独立发布和独立维护不是核心价值, submodule 带来的状态同步成本不值得保留。
2. 再判断单仓库形态: 不采用根目录直接平铺 skill, 而是在项目根目录下新增 `skills/` 集中承接实际 skill。
3. 最后处理 README 和历史: README 作为人类介绍页迁入 `docs/skills/`, 子仓库历史通过 subtree 导入后再移动到最终路径, 让最终结构干净且可用 `git log --follow` 追溯。

## 决定
- 采用: 用 `skills/<skill-name>/` 直接承接所有实际可打包 skill, 每个一级目录必须包含 `SKILL.md`。
- 采用: 用 `docs/skills/` 承接原子仓库 README 和后续面向人类的 skill 介绍页。
- 采用: 删除 `.gitmodules`、submodule 指针、子仓库独立 release workflow、子仓库 hook 和子仓库 hash 基线。
- 采用: 主仓库脚本直接扫描 `skills/` 发现 skill, updater source path 指向 `zxyycom/skills` 的 `skills/<skill-name>/`。
- 采用: `skill-package.hash` 继续作为聚合 release 门禁, 但 hash 计算读取主仓库 Git index 中 `skills/` 下的 blob。
- 采用: 只保留主仓库聚合版本化 release 和 `skills-latest` 兼容入口。
- 不采用: 保留 `子仓库/skill/<skill-name>/` 的二级仓库形态; 这会把 submodule 迁移成普通目录, 但仍留下旧 owner 边界。
- 不采用: 把 skill 直接平铺在项目根目录; 这会让 skill 本体和项目级维护文件混在一起。
- 触发条件: 后续只要本仓库仍是个人集中维护的 skill 集合, 新增 skill 就进入 `skills/`, 不再新增 submodule。

## 影响
- 日常维护只需要检查主仓库状态, 不再有子仓库提交、推送和主仓库指针同步流程。
- 子仓库独立 release 入口不再作为当前交付契约; 使用者从主仓库 release 获取全部 skill zip。
- `docs/skills/` 的介绍页变化不进入 skill zip, 也不直接触发 package hash 变化。
- 需要追溯迁移前历史时, 使用 Git 历史和 rename 跟踪查看 `skills/` 与 `docs/skills/` 下文件的来源。

## 验证
- 仓库不存在 `.gitmodules`, 根目录存在 `skills/` 和 `docs/skills/`。
- `scripts/lib/project.ts` 从 `skills/` 发现 skill, `scripts/sync-skill-updaters.ts` 生成主仓库 source path。
- `.github/workflows/package-skills.yml` 不再 checkout submodule。
- `docs/tooling.md` 和 `AGENTS.md` 记录单仓库布局、hash、hook 和发布规则。
