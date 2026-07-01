# 项目工具链

本文档是主仓库脚本、依赖安装、校验、打包和 CI 的 owner 文档。README 只保留入口说明，AGENTS 只记录长期项目边界，具体工具链标准在这里维护。

## 职责边界

本文件负责：

1. package scripts 的用途和命名。
2. pnpm 与 Bun 的职责分工。
3. `scripts/` 下共享自动化脚本的基础标准。
4. 本地校验、打包和可交付制品规则。
5. GitHub CI 如何复用本地入口并发布全部 skill 制品。
6. 子仓库自身 release workflow 的最小职责。

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
4. `bun run hash:skills`: 计算当前所有 skill 打包输入的 SHA-256 hash，并与根目录 `skill-package.hash` 中最近已发布 hash 对比。
5. `bun run pack:skills`: 将各子仓库 `skill/*/` 下每个 skill 分别打包为 `dist/<skill-name>.zip`。
6. `bun run sync:skill-updaters`: 按主仓库模板和子仓库配置生成各 skill 内的 `scripts/update-skill.cjs`。
7. `bun run check:skill-updaters`: 检查各 skill 内的 `scripts/update-skill.cjs` 是否由当前主仓库模板生成。
8. `bun run check`: 先类型检查，再检查 skill updater 生成状态，再校验并打包全部 skill。
9. `bun run deploy:package`: 复用 `check` 生成本地可交付 zip 制品，不写入仓库外目录；CI 发布由 workflow 负责。

需要直接排查脚本问题时，可以用 `bun scripts/<script>.ts` 运行单个脚本。

## 脚本标准

1. 脚本使用 TypeScript 编写，放在主仓库 `scripts/`。
2. 根目录 `tsconfig.json` 是脚本 IDE 类型提示和 `tsgo` 的统一配置；脚本依赖 Node 类型，运行仍由 Bun 负责。
3. 顶层脚本只保留命令编排和输出；跨脚本共享能力放在 `scripts/lib/`，具体校验项放在 `scripts/validators/`。
4. 脚本优先覆盖所有 skill 的共同规则；确实存在 skill 专属规则时，在脚本中集中声明。
5. 脚本处理常见行为时优先使用高质量、高热度、维护活跃且有类型支持的库；只有规则属于本仓库领域约束时才在脚本中直接实现。
6. 脚本默认只读写主仓库内路径；需要生成产物时输出到主仓库 `dist/`。
7. 文件发现使用 `fast-glob`，避免在多个脚本中维护递归目录遍历。
8. Skill frontmatter 使用 `yaml` 解析，避免手写 YAML 字符串解析。
9. 打包脚本使用 `fflate` 生成 zip，只打包子仓库 `skill/<skill-name>/`，不把项目文档、CI、脚本或仓库元数据放进 skill zip；每次打包前清空 `dist/`，避免残留旧 skill 制品。
10. Markdown 链接提取使用 `mdast-util-from-markdown` 解析 Markdown AST；脚本负责仓库路径、状态来源和项目约束校验。
11. Markdown 内部链接目标必须是仓库内路径且目标存在；`#anchor` 必须匹配目标 Markdown 文件中的标题锚点。
12. 决策记录校验保留为独立入口，总校验复用同一 validator 规则。
13. Skill 发布 hash 只覆盖会进入 skill zip 的文件路径和文件内容；子仓库中 `skill/` 外的 README、元数据或普通维护文件变化不触发 release 发布。
14. 校验脚本不解析 workflow 结构, 也不通过正则检查 workflow 内部步骤; workflow 逻辑由文档约定、代码审查和 GitHub Actions 实际运行结果验证。
15. Skill 自更新脚本的通用逻辑由主仓库 `scripts/templates/update-skill.ts` 承接；各 skill 包内只保留打包生成的 `scripts/update-skill.cjs`。

## Skill 自更新脚本

每个 skill 包内包含 `scripts/update-skill.cjs`。该脚本用于已安装 skill 的自检和可选更新：它读取脚本内的配置项，从对应 GitHub 子仓库下载 zip，使用 `fflate` 解压出 `skill/<skill-name>/` 路径，计算远端指纹并与当前本地 skill 目录比较；发现不一致时，默认询问是否覆盖更新，传入 `--yes` 时直接更新。

自更新脚本源码使用 TypeScript 和项目依赖，分发时由 Bun 默认 `--minify` 打包成压缩后的单文件 CommonJS，不支持多种压缩方案或额外压缩配置。已安装 skill 运行生成后的 `update-skill.cjs` 时，不依赖主仓库 Bun/pnpm 工具链，也不读取主仓库脚本。需要访问私有仓库或提高 GitHub API 限额时，可通过 `GITHUB_TOKEN` 或 `GH_TOKEN` 提供 token。

生成后的 `update-skill.cjs` 主体不要求保持源码可读性；顶部必须保留生成说明，写明主仓库 TypeScript 模板的 GitHub raw 链接和该 skill 的 GitHub 源目录。`--help` 和正常运行输出也要显示同样的维护入口，方便使用者在脚本报错时定位应修改的源文件，而不是直接修改打包后的 CJS 产物。

维护方式：

1. 通用源码只改 `scripts/templates/update-skill.ts`。
2. 运行 `bun run sync:skill-updaters` 将模板按各 skill 的 repo、ref 和 source path 渲染后打包到子仓库 `skill/<skill-name>/scripts/update-skill.cjs`。
3. `bun run check` 会执行 `check:skill-updaters`，避免已分发脚本与主仓库模板漂移。
4. 生成脚本进入 skill zip，因此会改变 skill package hash；`skill-package.hash` 仍只由发布成功后的 CI 写回。

已安装 skill 可在对应 skill 目录内运行：

```bash
node scripts/update-skill.cjs --check
node scripts/update-skill.cjs
node scripts/update-skill.cjs --yes
```

## CI 标准

GitHub CI 复用本地入口：

1. 安装 Bun，用于执行 TypeScript 脚本。
2. 安装 pnpm，用于依赖安装。
3. 运行 `pnpm install --frozen-lockfile`。
4. 运行 `bun run check`。
5. 运行 `bun scripts/hash-skills.ts --github-output`，把当前 skill hash、已记录 hash 和是否变化写入 job outputs；非 `github-actions[bot]` 的 `main` push 事件优先使用 `github.event.before` 中的旧 `skill-package.hash` 作为比较基线，避免同一提交提前改 hash 文件导致发布被跳过。
6. 上传 `dist/*.zip` 作为 workflow artifact，方便从单次运行中排查制品。
7. 对 `main` 分支的 `push` 和 `workflow_dispatch`，仅当当前 hash 与 `skill-package.hash` 不一致时发布或更新 GitHub Release `skills-latest`，并上传全部 `dist/*.zip`。
8. Release 更新成功后，CI 将本次 hash 写回 `skill-package.hash` 并提交到 `main`，作为下一次发布判断的基线。

CI 发布使用固定 release tag `skills-latest`。该 tag 指向最新发布提交，release asset 始终覆盖为当前全部 skill zip。PR 只运行校验、打包、hash 计算和 artifact 上传，不发布 release。只改主仓库文档、脚本、CI 或子仓库 `skill/` 外文件时，hash 不变，CI 不覆盖 latest release。

## 子仓库发布

每个 skill 子仓库保留 `.github/workflows/publish-skill-package.yml` 和 `skill-package.hash`，用于该子仓库自身的独立 release。

子仓库发布规则：

1. 触发范围只覆盖 `main` 的 `skill/**` 变化、workflow 自身变化和手动触发。
2. 使用 `git rev-parse HEAD:skill` 计算当前 `skill/` tree hash，并与子仓库根目录 `skill-package.hash` 对比。
3. Hash 不一致时，将该子仓库 `skill/*/` 下每个 skill 分别打包为 `dist/<skill-name>.zip`。
4. 发布或更新子仓库自己的 latest release，tag 使用 `<repo-name>-latest`，assets 覆盖为当前 `dist/*.zip`。
5. 发布成功后，workflow 将本次 `skill/` tree hash 写回 `skill-package.hash` 并提交到该子仓库 `main`。
6. 子仓库 workflow 不安装主仓库 Bun/pnpm 工具链，不复制主仓库 TypeScript 脚本；它只承接该子仓库独立交付所需的最小打包和发布步骤。

子仓库独立 release 与主仓库聚合 release 并存：子仓库 release 方便单独安装某个 skill 集合，主仓库 `skills-latest` 继续提供全部 skill 的统一入口。维护时通过 review 确认子仓库发布入口和 hash 基线是否需要同步调整。
