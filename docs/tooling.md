# 项目工具链

本文档是主仓库脚本、依赖安装、校验、打包和 CI 的 owner 文档。README 只保留入口说明，AGENTS 只记录长期项目边界，具体工具链标准在这里维护。

## 职责边界

本文件负责：

1. package scripts 的用途和命名。
2. pnpm 与 Bun 的职责分工。
3. `scripts/` 下共享自动化脚本的基础标准。
4. 本地校验、打包和可交付制品规则。
5. GitHub CI 如何复用本地入口并发布全部 skill 制品。

本文件不负责 skill 行为、引用内容、决策记录格式或 agent 项目级协作规则。

## 工具分工

1. pnpm 管安装：`packageManager` 使用 pnpm，锁文件使用 `pnpm-lock.yaml`，CI 安装依赖使用 `pnpm install --frozen-lockfile`。
2. Bun 管脚本调度和执行：本地和 CI 通过 `bun run <script>` 调用 package scripts；package scripts 内部直接调用 Bun 执行 TypeScript 脚本。
3. `tsgo` 管类型检查：`typecheck` 使用 `@typescript/native-preview` 提供的原生 TypeScript 编译器预览版。
4. package scripts 是统一入口：本地和 CI 都通过 package scripts 调用脚本，不维护另一套命令。
5. 脚本依赖按本地开发工具链处理：常见格式、协议、解析和压缩能力优先使用成熟库，不为减少依赖手写底层实现。
6. `@typescript/native-preview` 是预览包；使用固定版本，并通过 `pnpm-workspace.yaml` 记录对应版本的 release-age 例外。

## 脚本入口

当前脚本入口：

1. `bun run typecheck`: 使用 `tsgo --noEmit` 和根目录 `tsconfig.json` 检查 `scripts/**/*.ts`，不输出编译产物。
2. `bun run validate`: 校验全部 submodule skill 入口、内部链接、决策记录结构和主仓库项目配置。
3. `bun run validate:decisions`: 单独校验 `docs/decisions/` 的目录、文件结构、索引链接和状态来源链接目标。
4. `bun run pack:skills`: 将各子仓库 `skill/*/` 下每个 skill 分别打包为 `dist/<skill-name>.zip`。
5. `bun run check`: 先类型检查，再校验，最后打包全部 skill。
6. `bun run deploy:package`: 复用 `check` 生成本地可交付 zip 制品，不写入仓库外目录；CI 发布由 workflow 负责。

需要直接排查脚本问题时，可以用 `bun scripts/<script>.ts` 运行单个脚本。

## 脚本标准

1. 脚本使用 TypeScript 编写，放在主仓库 `scripts/`。
2. 根目录 `tsconfig.json` 是脚本 IDE 类型提示和 `tsgo` 的统一配置；脚本依赖 Node 类型，运行仍由 Bun 负责。
3. 脚本优先覆盖所有 skill 的共同规则；确实存在 skill 专属规则时，在脚本中集中声明。
4. 脚本处理常见行为时优先使用高质量、高热度、维护活跃且有类型支持的库；只有规则属于本仓库领域约束时才在脚本中直接实现。
5. 脚本默认只读写主仓库内路径；需要生成产物时输出到主仓库 `dist/`。
6. 文件发现使用 `fast-glob`，避免在多个脚本中维护递归目录遍历。
7. Skill frontmatter 使用 `yaml` 解析，避免手写 YAML 字符串解析。
8. 打包脚本使用 `fflate` 生成 zip，只打包子仓库 `skill/<skill-name>/`，不把项目文档、CI、脚本或仓库元数据放进 skill zip。
9. Markdown 链接提取使用 `mdast-util-from-markdown` 解析 Markdown AST；脚本负责仓库路径、状态来源和项目约束校验。
10. Markdown 内部链接目标必须是仓库内路径且目标存在；`#anchor` 必须匹配目标 Markdown 文件中的标题锚点。
11. 决策记录校验保留为独立脚本，总校验复用同一规则。

## CI 标准

GitHub CI 复用本地入口：

1. 安装 Bun，用于执行 TypeScript 脚本。
2. 安装 pnpm，用于依赖安装。
3. 运行 `pnpm install --frozen-lockfile`。
4. 运行 `bun run check`。
5. 上传 `dist/*.zip` 作为 workflow artifact，方便从单次运行中排查制品。
6. 对 `main` 分支的 `push` 和 `workflow_dispatch`，发布或更新 GitHub Release `skills-latest`，并上传全部 `dist/*.zip`。

CI 发布使用固定 release tag `skills-latest`。该 tag 指向最新发布提交，release asset 始终覆盖为当前全部 skill zip。PR 只运行校验、打包和 artifact 上传，不发布 release。
