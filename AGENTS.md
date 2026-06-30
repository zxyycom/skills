# Agent Instructions

## 项目边界

1. 本仓库是 Codex skills 的主仓库，使用 Git submodule 组织多个 skill 子仓库。
2. 主仓库承接共享说明、维护约定、决策记录、工具链、自动化脚本、CI、发布流程和 submodule 指针。
3. 子仓库应尽量只保留 `skill/` 下的 skill 本体和随 skill 分发的文件；不要在子仓库内重复新增共享脚本、CI 或项目级维护文档。

## 维护原则

1. 修改前先判断当前所在仓库。skill 行为写入对应子仓库，通用工具链和维护规则写入主仓库。
2. 更新任一子仓库后，回到主仓库检查 `git status --short`，确认 submodule 指针是否需要提交。
3. 新增或调整脚本时优先做成对所有 skill 通用的能力；只有确实存在 skill 专属规则时才在脚本中显式分支。
4. 新增 skill 子仓库后同步检查 `README.md`、`.gitmodules`、`scripts/validate.ts`、`scripts/pack-skills.ts` 和 `.github/workflows/package-skills.yml` 是否仍覆盖该 skill。
5. 脚本、安装、校验、打包和 CI 的细节由 `docs/tooling.md` 承接；`AGENTS.md` 只保留长期项目边界。
6. 决策记录只记录后续维护需要回放原因的判断，不作为普通变更日志。
7. 正文主要使用中文；除用户要求或目标文件已有语言要求外，新增内容保持中文。
