# 工具链环境自举

本文承接工具分工、环境准备及恢复；工具链整体关系见[项目工具链](tooling.md)，日常命令见[稳定维护命令](tooling-commands.md)。

## 工具分工

1. pnpm 负责安装依赖；固定版本来自 `package.json#packageManager`，锁文件是 `pnpm-lock.yaml`，CI 使用 `pnpm install --frozen-lockfile`。
2. Bun 负责 package scripts 调度、源码同步适配和仓库中其余 TypeScript 脚本运行；本地与 hook 复用 `PATH` 上可运行的 Bun，不设置版本号前置门槛。CI 使用 workflow 选定的版本；生成一致性与实际测试承担兼容性验收，工具链指纹继续记录实际版本。优先通过 `bun run <script>` 使用稳定入口。
3. Node.js 负责运行分发 TS 入口、`@zxyycom/vibe-check` 的 Gate 入口及其原生测试；最低兼容版本由 `package.json#engines.node` 定义，`bun run check`、`bun run check:changed` 与 `bun run test:check` 是稳定的人工作业入口。
4. tsgo 负责类型检查；`typecheck` 使用固定版本的 `@typescript/native-preview`，对应 release-age 例外记录在 `pnpm-workspace.yaml`。
5. 常见格式、协议、解析和压缩能力优先使用成熟依赖；项目领域规则才由本仓库直接实现。

## 环境自举

`scripts/environment.js` 是进入项目工具链前的跨平台独立入口，只使用 Node.js 标准库，不依赖 Bun、pnpm、项目包或 `bun run check`。`check` 明确表示完整只读诊断，`gate` 只读诊断权威 Gate 的基础工具前置，`setup` 明确表示会补齐工具、依赖和仓库本地配置。

只读检查环境：

```bash
node scripts/environment.js check
```

只读检查 Gate 基础工具前置：

```bash
node scripts/environment.js gate
```

补齐 Bun、pnpm、锁定依赖和仓库本地配置：

```bash
node scripts/environment.js setup
```

环境入口遵守以下边界：

1. Git、满足 `package.json#engines.node` 的 Node.js、全局 CodeGraph 和 SCC 4.0.0 是前置条件；入口只诊断和复用它们，不安装或升级它们。Bun 检查可运行性，pnpm 服从 manifest 中的精确版本。函数指标使用 Vibe 随包分析器。
2. `check` 检查 Git、Node.js、Bun、pnpm、CodeGraph、SCC、索引状态、直接依赖、Git hook 和中央 task-graph root，不下载或修改环境。
3. `gate` 只检查 Git、Node.js、可运行的 Bun、精确 pnpm 与精确 SCC，不要求 CodeGraph 索引、项目依赖、hook 或 task-graph root；Gate 中每次执行的 `gate-environment` Check 调用同一入口，失败时保留工具探测结果，并通过依赖阻止其他 Check 执行，避免把基础环境漂移扩散成生成物、测试或指标的伪失败。
4. `setup` 复用已有可运行的 Bun，只在不可用时通过 npm 安装 Bun；pnpm 按 manifest 固定版本安装或切换。随后运行 `pnpm install --frozen-lockfile`，调用已就绪的全局 CodeGraph 执行 `init` 和 `sync`，并配置当前 worktree；Git、Node.js、CodeGraph 或 SCC 缺失、版本不匹配或探测失败时会在任何安装前失败并给出恢复动作。
5. 恢复外部指标工具时，必须让精确 SCC 版本进入 `PATH`。mise 用户可运行 `mise use go:github.com/boyter/scc/v4@4.0.0` 选择已安装版本；其他环境可运行 `go install github.com/boyter/scc/v4@v4.0.0` 安装。仅存在 mise shim 而未选择版本时，`scc --version` 会以非零状态退出，环境入口会保留该诊断而不是误报为指标 finding。环境入口不替代类型检查、测试、生成漂移检查或完整仓库检查。

仓库本地配置由 `scripts/setup-repository.js` 承接：

1. 当前 worktree 的 `core.hooksPath` 会设为 `.githooks`；hook 本身以可执行 mode 进入版本管理，POSIX setup 另外恢复工作区执行位，Windows 使用其原生 Git hook 存在性语义。
2. 当前项目的默认 task root 每次从 Git worktree 结构发现为主 worktree，不额外持久化绝对路径；因此 linked worktree 与主 worktree 使用同一中央索引。
3. 每个新 clone 和 linked worktree 都运行标准环境 `setup`；这样 POSIX worktree 的文件权限会实际落地，所有平台的 `hooksPath` 也保持一致。

Codex 工作区在 `.codex/environments/` 提供两个入口：

1. `skills` 保留工作区内容并运行 `node scripts/environment.js setup`。
2. `clear` 先丢弃已跟踪改动和未跟踪文件，再运行同一 setup 入口；只在明确需要干净工作区时使用。

`.codex/config.toml` 通过全局 `codegraph serve --mcp` 启动代码图服务。`.codegraph/` 只提交维持忽略规则的 `.gitignore`，本机索引数据库不进入版本控制。

## 兼容入口

### 仓库维护短命令

详见[仓库维护短命令](tooling-commands.md#仓库维护短命令)。

### 工具维护命令

详见[工具维护命令](tooling-commands.md#工具维护命令)。
