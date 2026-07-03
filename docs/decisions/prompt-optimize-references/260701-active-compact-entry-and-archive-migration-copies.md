# 2026-07-01 - 压缩 prompt-optimize 入口并归档迁移副本

## 状态

- 当前状态: active
- 导致状态变化的决策: 无
- 状态说明: 作为当前 `prompt-optimize` 入口长度和迁移副本位置的维护规则使用; 修订 2026-06-30 将核心流程合并回入口后的细节展开方式。

## 问题

- `skills/prompt-optimize/SKILL.md` 在承接默认执行路径后, 同时保留了过多细则展开, 使用时需要关注的点过多。
- `workflows.md` 和 `rewrite-rules.md` 已不参与主动读取, 继续放在 `references/` 根目录会让维护者误以为它们仍是普通引用文件。

## 背景与约束

- 用户明确要求先尝试压缩入口, 且不要删除迁移保留文件, 而是移到 `references/archive/`。
- 入口仍需要保留默认执行路径, 不能退回到必须读取旧 `workflows.md` 或 `rewrite-rules.md` 才能完成主流程。

## 决定

- 采用: `SKILL.md` 继续作为默认执行路径 owner, 但主执行流程只保留压缩后的八步判断链, 细节解释由 `principles.md` 和具体任务上下文承接。
- 采用: `workflows.md` 和 `rewrite-rules.md` 移入 `skills/prompt-optimize/references/archive/`, 作为迁移前旧结构留存。
- 采用: `references/archive/` 只作为文件保留位置, 不写入入口主动引用清单。
- 不采用: 删除迁移副本。原因是用户要求保留, 且旧结构仍有回溯价值。
- 触发条件: 后续维护 `prompt-optimize` 时, 如果旧结构只用于回溯且不参与执行路径, 放入 `references/archive/`; 只有会直接影响当前执行质量的引用才留在 `references/` 根目录。

## 影响

- `prompt-optimize` 的入口阅读负担降低, 但默认执行路径仍能独立完成生成、审阅和直接编辑任务。
- `references/` 根目录只保留当前主动引用资料, archive 内容不进入默认读取路径。
- 后续新增引用文件时, 需要先判断它是否会被触发、执行或交付流程直接使用; 仅用于回溯的内容进入 archive。

## 验证

- `skills/prompt-optimize/SKILL.md` 已压缩主执行流程, 主动引用清单不包含 `references/archive/`。
- `skills/prompt-optimize/references/archive/rewrite-rules.md` 和 `skills/prompt-optimize/references/archive/workflows.md` 已保留迁移前旧结构。
- 主仓库校验应能通过链接和 Markdown 检查。
