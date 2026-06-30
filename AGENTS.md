# Agent Instructions

## 项目边界

1. 本仓库是 Codex skills 主仓库, 使用 Git submodule 组织多个独立 skill 子仓库; `.gitmodules` 和 submodule 指针属于主仓库维护面。
2. 主仓库根目录、`docs/`、`scripts/`、`.github/`、`package.json` 和锁文件只承接共享说明、维护约定、决策记录、工具链说明、自动化脚本、CI、发布流程和仓库元数据。
3. 子仓库承接各自 skill 本体和随 skill 分发的文件: `prompt-optimize/skill/prompt-optimize/`、`git-commit-organizer/skill/git-commit-organizer/`、`openspec-skills/skill/openspec-*`。
4. 子仓库应尽量只保留 `skill/` 下的 skill 本体; 不在子仓库重复新增共享脚本、CI、发布流程、项目级维护文档或主仓库工具链说明。
5. 长期文档只写当前主仓库和 submodule 内可维护的信息; 仓库外路径、临时来源、迁移来源和一次性调查上下文不进入长期文档。

## 内容 Owner

1. Skill 触发条件、读取策略、执行流程、引用文件、示例、边界和验收标准写入对应子仓库的 skill 本体。
2. 跨 skill 共享的校验、打包、发布、依赖入口、CI 和自动化脚本写入主仓库。
3. 脚本、安装、校验、打包和 CI 的细节由 `docs/tooling.md` 承接; `AGENTS.md` 只保留长期稳定的 agent 协作约定。
4. 决策记录格式、门槛、状态关系和更新流程由 `docs/decisions/decision-record-rules.md` 承接; 决策清单由 `docs/decisions/decision-record-index.md` 承接。
5. 同一判断同时涉及多个文件时, 先确定最稳定的 owner; 非 owner 位置只保留摘要、触发条件或引用。

## 维护原则

1. 修改前先判断当前所在仓库。主仓库状态不能代表子仓库状态, 子仓库状态也不能代表主仓库指针是否已更新。
2. 保持改动范围与用户请求对齐; 不为了整理文档、统一风格或顺手清理而重写无关内容。
3. 新增长期规则前先判断 owner; 只有当前文件适合承接项目级 agent 约定时, 才修改 `AGENTS.md`。
4. 新增或调整脚本时优先做成对所有 skill 通用的能力; 只有确实存在 skill 专属规则时才在脚本中集中声明分支。
5. 新增 skill 子仓库后同步检查 `README.md`、`.gitmodules`、`scripts/validate.ts`、`scripts/pack-skills.ts` 和 `.github/workflows/package-skills.yml` 是否仍覆盖该 skill。
6. 正文主要使用中文; 除用户要求、目标文件已有语言要求或代码/API 名称外, 新增维护文本保持中文。

## 多仓库流程

1. 修改子仓库内容时, 先进入对应子仓库检查 `git status --short --branch`, 再判断是否存在用户未提交改动。
2. 更新任一子仓库后, 先在子仓库提交并推送, 再回到主仓库检查并提交 submodule 指针。
3. 只修改主仓库文档、脚本、CI 或配置时, 不进入子仓库制造变更。
4. 需要确认整体状态时, 分别检查主仓库和三个子仓库: `prompt-optimize`、`git-commit-organizer`、`openspec-skills`。
5. 打包产物输出到主仓库 `dist/`; `dist/` 和依赖目录不作为长期源文件提交。

## 决策记录

1. 决策记录只记录后续维护需要回放原因的判断, 不作为变更日志。
2. Skill 行为、触发条件、读取策略、引用 owner、规则边界或验收标准发生变化时, 按 `docs/decisions/decision-record-rules.md` 判断是否达到记录门槛。
3. 项目级决策只在改变长期维护契约、目录边界、自动化交付方式或跨文件 owner 时记录。
4. 单个 skill 专属决策要在标题、影响面或正文中写明适用 skill 和当前子仓库路径, 避免写成全部 skill 的通用规则。
5. 普通文字修正、格式调整、链接修复和按既有规则执行的一次性细节不记录。

## 验证与交付

1. 修改主仓库维护文档、脚本、CI 或 submodule 指针后, 优先运行 `bun run check` 验证整体结构、链接和 skill 打包。
2. 只改某个子仓库 skill 本体时, 根据该子仓库内容选择最小验证; 回到主仓库后确认 submodule 指针状态。
3. 提交或汇报前说明实际运行过的验证; 未运行验证时直接说明原因。
