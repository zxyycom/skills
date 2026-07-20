# 2026-07-20 - 用预构建 Git fixture 加速 test-evidence 测试

## 索引摘要
- 目的: 在保留真实 Git 语义和 Node 分发兼容验证的前提下，减少 `test:test-evidence-cli` 的重复仓库初始化与子进程启动。
- 背景: `scripts/test-evidence/tests/` 为多个稳定场景反复创建仓库和提交相同基线，主要耗时来自 Git 与 Node 进程而非领域计算。
- 决策: 使用多个预构建的逻辑 Git fixture 承接稳定历史，按场景物化隔离工作区；纯逻辑和可导入 CLI 测试在 Bun 进程内运行，只保留最小真实 Git 与 Node smoke。

## 目的
- 缩短主仓库 `test:test-evidence-cli` 和完整 `check` 的反馈时间。
- 继续证明 `test-evidence-review` 分发模块能够读取真实 Git 状态，并在只有 Node 的目标环境中作为 CLI 运行。
- 让 fixture 的历史、场景边界和重建方式可以审查和确定性验证，而不是依赖测试运行时重复拼装。

## 背景
- 本决定适用于主仓库的 `scripts/test-evidence/tests/` 及其 fixture，不改变 `skills/test-evidence-review/` 对使用者的 Node 运行时兼容边界。
- 有效、review 后提交、过期 review、不可用基线、无效测试入口和无效 catalog 等场景具有稳定的文件与提交历史，可以在测试运行前表达为独立逻辑 fixture。
- 只有工作区文件的 fixture 不能证明提交基线和历史差异；直接复制完整 `.git` 会重复小文件和索引 I/O，也不适合作为仓库内长期源格式。
- 主仓库已经使用 Bun 执行 TypeScript 脚本，分发模块也可以无副作用导入，因此大部分参数、格式和领域行为不需要通过重复 Node 子进程验证。

## 决策
- 采用: 为稳定场景维护多个预构建的逻辑 Git fixture，以 Git bundle、固定 refs 或等价的正式 Git 表达保存文件和提交历史；运行时只按场景物化隔离工作区，不再为每个场景重复执行完整的 `init`、`add` 和基线 `commit` 流程。
- 采用: 单个多 ref fixture、多个独立 fixture、local clone 和 linked worktree 都属于可选实现；根据 Windows 与 CI 的重复基准选择组合，不在本决定中固定物理拓扑。
- 采用: dirty 和 untracked 等不能进入 commit 的状态在对应 fixture 上通过 Bun 文件操作叠加；确实需要 index 状态时只执行该场景必要的最小 Git 操作。
- 采用: 纯领域逻辑、输出格式和可导入 CLI 行为默认在 Bun 进程内验证；保留足以证明真实 Git 集成和 Node 分发入口的最小端到端 smoke。
- 不采用: 把全部 Node 兼容验证替换为 Bun，或把复制原始 `.git` 目录作为默认 fixture 分发与物化方式。
