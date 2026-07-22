---
status: archived
alignment: null
createdAt: 2026-07-18T11:43:07+08:00
---

# 使用 skill hash 门禁 latest release 发布

## 索引摘要
- 目的: 只在可安装 skill 包内容变化时更新 latest release，避免产生虚假更新信号。
- 背景: 主仓库维护文档、脚本、CI 或子仓库 `skill/` 外文件变化时，旧 CI 也会覆盖 `skills-latest` release，但这些变化不一定改变可安装 skill 包。
- 决策: 根目录保留 `skill-package.hash`，记录最近一次成功发布的全部 skill 打包输入 hash。

## 目的
- 只在可安装 skill 包内容变化时更新 latest release，避免产生虚假更新信号。

## 背景
- 主仓库维护文档、脚本、CI 或子仓库 `skill/` 外文件变化时，旧 CI 也会覆盖 `skills-latest` release，但这些变化不一定改变可安装 skill 包。
- 子仓库通过 submodule 指针进入主仓库后，需要区分“指针变化导致 skill 内容变化”和“只变更非 skill 维护文件”。

- 主仓库仍是跨 skill 聚合打包和 `skills-latest` release 发布的 owner。
- 当前交付目标已由后续决策扩展为版本化 release；本记录保留 hash 门禁的原因和边界。
- Hash 判断应覆盖实际进入 skill zip 的文件路径和内容，避免 README、仓库元数据或主仓库维护文件误触发发布。

## 决策
- 采用: 根目录保留 `skill-package.hash`，记录最近一次成功发布的全部 skill 打包输入 hash。
- 采用: `scripts/hash-skills.ts` 复用 skill 发现规则，按稳定顺序计算所有 `skill/<skill-name>/` 文件路径和内容的 SHA-256。
- 采用: CI 在校验打包后计算当前 hash，只有当前 hash 与最近已发布 hash 不一致时才更新 `skills-latest` release；非 `github-actions[bot]` 的 `main` push 事件优先从 `github.event.before` 读取旧 `skill-package.hash` 作为比较基线。
- 采用: Release 更新成功后由 CI 写回并提交 `skill-package.hash`，把本次发布设为下一次判断基线。
- 不采用: 继续在每次 `main` push 或手动触发时无条件覆盖 release；这会让非 skill 变更也改写交付入口。

## 关系
- 修订: [使用 latest release 自动发布 skill 制品](260630-publish-skill-package-as-latest-release.md)
