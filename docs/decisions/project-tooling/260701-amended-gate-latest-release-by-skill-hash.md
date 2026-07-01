# 2026-07-01 - 使用 skill hash 门禁 latest release 发布

## 状态
- 当前状态: amended
- 导致状态变化的决策: [2026-07-01 - 不用脚本校验 workflow 结构](260701-active-avoid-workflow-structure-validation.md)
- 状态说明: Hash 门禁规则仍然生效；原记录中由校验脚本检查 CI hash 门禁的做法已取消。

## 问题
- 主仓库维护文档、脚本、CI 或子仓库 `skill/` 外文件变化时，旧 CI 也会覆盖 `skills-latest` release，但这些变化不一定改变可安装 skill 包。
- 子仓库通过 submodule 指针进入主仓库后，需要区分“指针变化导致 skill 内容变化”和“只变更非 skill 维护文件”。

## 背景与约束
- 主仓库仍是跨 skill 聚合打包和 `skills-latest` release 发布的 owner。
- 当前交付目标仍是固定 `skills-latest` release，而不是版本化 release。
- Hash 判断应覆盖实际进入 skill zip 的文件路径和内容，避免 README、仓库元数据或主仓库维护文件误触发发布。

## 决定
- 采用: 根目录保留 `skill-package.hash`，记录最近一次成功发布的全部 skill 打包输入 hash。
- 采用: `scripts/hash-skills.ts` 复用 skill 发现规则，按稳定顺序计算所有 `skill/<skill-name>/` 文件路径和内容的 SHA-256。
- 采用: CI 在校验打包后计算当前 hash，只有当前 hash 与最近已发布 hash 不一致时才更新 `skills-latest` release；非 `github-actions[bot]` 的 `main` push 事件优先从 `github.event.before` 读取旧 `skill-package.hash` 作为比较基线。
- 采用: Release 更新成功后由 CI 写回并提交 `skill-package.hash`，把本次发布设为下一次判断基线。
- 不采用: 继续在每次 `main` push 或手动触发时无条件覆盖 release；这会让非 skill 变更也改写交付入口。
- 触发条件: 后续只要 latest release 表示“当前可安装 skill 内容”，发布判断就以 skill hash 是否变化为准；当引入版本化 release 或外部发布系统时再重新决策。

## 影响
- 只改主仓库工具链、文档或子仓库 `skill/` 外内容时，CI 仍会校验和上传 workflow artifact，但不会覆盖 release。
- 子仓库 `skill/` 内容通过 submodule 指针进入主仓库后，会在主仓库 CI 中触发 release 更新。
- `skill-package.hash` 成为发布状态文件，不能当作普通临时产物忽略。

## 验证
- `.github/workflows/package-skills.yml` 使用 `needs.package.outputs.skill_hash_changed == 'true'` 作为发布门禁。
- `scripts/hash-skills.ts` 计算当前 hash 并支持写入 GitHub outputs。
- `docs/tooling.md` 记录 hash 门禁、发布后写回和非 skill 变更不发布的规则。
- `skill-package.hash` 记录当前已发布 hash；workflow 结构通过 review 和 GitHub Actions 运行结果确认。
