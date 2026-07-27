# Tasks

任务按契约审计、主题模型、索引接口、分发同步和行为验证推进，完成出口是可分发 test-evidence 工具完整支持受控 topic 目录。

## Readiness

- [x] 0.1 核对 proposal、design 和 tasks 都以“受控主题表、路径唯一归属、单 case 文件、统一索引”为同一目标，并确认不包含仓库 case 迁移或测试实现改造。
- [x] 0.2 对照当前 test-evidence v2 多主题文件基线、历史单文件 v1 和决策记录领域模型，列出需要保留、重写与删除的具体实现面。
- [x] 0.3 确认通用索引现有 typed metadata、领域 key、source revision 和 reader API 足以承接方案，不为测试主题修改通用协议。
- [x] 0.4 核对配置、公共结果、definition 和 skill 从当前 v2/版本 4 基线继续升级的唯一出口，并确认升级文档覆盖现有消费者。
- [x] 0.5 确认 `Open Questions` 没有阻塞实施的问题，并审阅根目录允许文件、空 topic 定义和单文件单 case 规则。

## Implementation

- [x] 1.1 增加测试主题目录表 loader、Valibot Schema、类型和确定性规范化，使 topic ID、description、顺序和重复校验只有一个实现 owner。
- [x] 1.2 收敛配置和路径模型，使 `catalogPath` 表示测试证据根目录，并严格校验根文件、topic 目录、单 case Markdown和禁止的嵌套或非文件成员。
- [x] 1.3 重构 catalog parser 与 validation，使每个源文件恰好产生一个 case，并在完整集合上校验 case ID 唯一性和路径 topic 合法性。
- [x] 1.4 更新 test-evidence 状态索引 definition：metadata 投影 topics，state 保留 sourcePath，topic key 从路径派生，source revision 覆盖主题表和全部 case 源。
- [x] 1.5 增加 `topics` 与单值 `list --topic`，并让 list、show、check、sync-index 和 JSON 输出按固定结构提供相关主题定义和诊断。
- [x] 1.6 更新配置、query、show、report、sync 和 state-index Schema、公共声明及领域 definition 版本，删除中间直接子级主题文件格式。
- [x] 1.7 更新 `test-evidence-review` 的 SKILL、固定目录契约、人类说明和升级文档，明确 topic 只组织 case、不改变原生测试入口粒度。
- [x] 1.8 重建可分发 MJS、source map、JSON Schema 和声明，并确保 skill 版本相对已提交基线只提升一次。
- [x] 1.9 在长期决策 owner 中通过 evolve 建立最终主题路径判断，并修订当前活动或既有记录中与最终目录、身份和索引 metadata 冲突的内容；新决策先保持 unaligned，等待真实仓库迁移和 strict check 后再建立 aligned 基线。

## Verification

- [x] 2.1 增加主题表测试，覆盖缺失、非法 JSON、未知字段、重复或乱序 ID、非法描述、已定义空 topic 和未知目录。
- [x] 2.2 增加目录测试，覆盖一个文件多个 case、空文件、嵌套目录、非 Markdown、符号链接、空 topic 目录、跨 topic 重复 case ID，以及 indexPath 与 topics、README、config、case 的路径或硬链接冲突。
- [x] 2.3 增加索引测试，覆盖 metadata.topics、路径派生 topic key、主题描述或文件移动导致 revision 失配，以及纯换行规范化不造成虚假漂移。
- [x] 2.4 增加 CLI 和公共接口测试，覆盖 topics 无索引读取、list 单 topic 与空结果、未知或重复参数、show 主题定义、内存投影和严格同步失败。
- [x] 2.5 运行 test-evidence 目标测试、生成漂移检查、skill 结构验证、`bun run typecheck` 和 `bun run check --strict`，记录通用实现与真实仓库迁移组合后的最终证据，不用兼容双读规避原子交付门禁。
  - 2026-07-27 最终证据：真实仓库已显式迁移为 v3 的 9 个 topic、106 个单文件
    case，目标 runner 31/31 通过；长期决策为 43 active、43 aligned、0 unaligned；
    `bun run check --strict` 的 23 项前置检查与 packaging 通过，typecheck、validate、
    catalog、change-plan 和 diff 检查也通过。共同关闭过程没有引入 v2 双读或隐式
    fallback。
- [x] 2.6 用临时消费者工作区分别执行单文件 v1 和直属主题文件 v2 到 topic 根目录的升级演练，确认文档步骤足以得到合法目录和统一索引，且没有自动源码采集或双轨读取。
