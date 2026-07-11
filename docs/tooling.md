# 项目工具链

本文档是主仓库脚本、依赖安装、校验、打包和 CI 的 owner 文档。README 只保留入口说明，AGENTS 只记录长期项目边界，具体工具链标准在这里维护。

## 职责边界

本文件负责：

1. package scripts 的用途和命名。
2. pnpm 与 Bun 的职责分工。
3. `scripts/` 下共享自动化脚本的基础标准。
4. 本地校验、打包和可交付制品规则。
5. GitHub CI 如何复用本地入口并发布全部 skill 制品。
6. `skills/` 单仓库布局下的 hash、hook 和自更新脚本规则。

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
2. `bun run validate`: 校验 `skills/` 下全部 skill 入口、内部链接、决策记录结构和主仓库项目配置。
3. `bun run validate:decisions`: 通过 `decision-records` skill 的 CLI 单独校验 `docs/decisions/` 的目录、文件结构、正文状态、活动索引、归档位置和状态来源链接目标。
4. `bun run hash:skills`: 计算当前 Git index 中所有 skill 打包输入的聚合 SHA-256 hash 和单 skill hash，并与根目录 `skill-package-lock.json` 对比；传入 `--write` 时写回当前状态，传入 `--check` 时不一致则失败，传入 `--quiet` 时只在 hash 或 lock 内容变化时输出。
5. `bun run pack:skills`: 读取 Git index 中 `skills/<skill-name>/` 的 blob，将每个 skill 分别打包为 `dist/<skill-name>.zip`，并把 `skill-package-lock.json` 复制为 release manifest asset。
6. `bun run setup-hooks`: 将主仓库 `core.hooksPath` 设置为 `.githooks`。
7. `bun run test:decision-records-cli`: 使用独立夹具测试 `decision-records` TypeScript 源码、Node 分发产物和生成头追溯字段。
8. `bun run sync:decision-records-cli`: 从 `scripts/decision-records/` 构建并写入 skill 内的 `scripts/decision-records.mjs`。
9. `bun run check:decision-records-cli`: 在临时目录构建 CLI，并检查 skill 内分发产物是否与当前源码一致。
10. `bun run sync:skill-updaters`: 按主仓库模板和 `skills/` 发现结果生成各 skill 内的 `scripts/update-skill.cjs`。
11. `bun run check:skill-updaters`: 检查各 skill 内的 `scripts/update-skill.cjs` 是否由当前主仓库模板生成。
12. `bun run check`: 依次运行类型检查、生成产物检查、CLI 测试、项目校验和全部 skill 打包。
13. `bun run deploy:package`: 复用 `check` 生成本地可交付 zip 制品，不写入仓库外目录；CI 发布由 workflow 负责。

需要直接排查脚本问题时，可以用 `bun scripts/<script>.ts` 运行单个脚本。

## 脚本标准

1. 脚本使用 TypeScript 编写，放在主仓库 `scripts/`。
2. 根目录 `tsconfig.json` 是脚本 IDE 类型提示和 `tsgo` 的统一配置；脚本依赖 Node 类型，运行仍由 Bun 负责。
3. 顶层脚本只保留命令编排和输出；跨脚本共享能力放在 `scripts/lib/`，具体校验项放在 `scripts/validators/`。
4. 脚本优先覆盖所有 skill 的共同规则；确实存在 skill 专属规则时，在脚本中集中声明。
5. 脚本处理常见行为时优先使用高质量、高热度、维护活跃且有类型支持的库；只有规则属于本仓库领域约束时才在脚本中直接实现。
6. 脚本默认只读写主仓库内路径；临时打包产物输出到 `dist/`，需要随 skill 分发的生成脚本通过显式 `sync:*` 写入对应 skill，并由配套 `check:*` 检查漂移。
7. 文件发现使用 `fast-glob`，避免在多个脚本中维护递归目录遍历。
8. Skill frontmatter 使用 `yaml` 解析，避免手写 YAML 字符串解析。
9. 打包脚本使用 `fflate` 生成 zip，只打包 `skills/<skill-name>/` 内文件，不把项目文档、CI、脚本或仓库元数据放进 skill zip；每次打包前清空 `dist/`，避免残留旧 skill 制品。
10. Markdown 链接提取使用 `mdast-util-from-markdown` 解析 Markdown AST；脚本负责仓库路径、状态来源和项目约束校验。
11. Markdown 内部链接目标必须是仓库内路径且目标存在；`#anchor` 必须匹配目标 Markdown 文件中的标题锚点。
12. 决策记录校验保留为独立入口，总校验通过薄适配器复用 `skills/decision-records/scripts/decision-records.mjs`，避免项目校验与已分发 CLI 漂移。
13. Skill 发布 hash 和 skill zip 都只覆盖会进入 skill zip 的文件路径和 Git blob 内容；`docs/skills/` 介绍页、项目文档、脚本和 CI 变化不直接触发 skill release。仓库脚本源码变化需要先同步为 skill 内生成产物，只有分发产物发生变化时才改变对应 hash。Hash 计算和打包都读取 Git index 中的 blob，避免 Windows 与 Linux 工作区换行差异导致本地 hook、CI 和 release asset 结果不一致。根目录 `skill-package-lock.json` 是唯一发布状态文件，记录聚合 hash 和每个 skill 的独立 hash。
14. 校验脚本不解析 workflow 结构, 也不通过正则检查 workflow 内部步骤; workflow 逻辑由文档约定、代码审查和 GitHub Actions 实际运行结果验证。
15. Skill 自更新脚本的通用逻辑由主仓库 `scripts/templates/update-skill.ts` 承接；各 skill 包内只保留打包生成的 `scripts/update-skill.cjs`。
16. 可嵌入注释的生成脚本顶部必须写明禁止直接编辑、仓库链接、线上可维护源码链接、仓库内源码路径、对应 skill 源目录和重建命令；按产物用途补充 release asset 等必要入口。生成头不写时间戳、本机绝对路径或其他非确定性状态。不能嵌入注释的 JSON 等机器制品由稳定生成入口和本文件承接追溯关系。

## Skill 分发脚本

需要编译后随 skill 分发的脚本采用源码与产物分离：

1. TypeScript 源码、测试、夹具和构建入口放在主仓库 `scripts/<tool-name>/`。
2. 构建后的单文件 JavaScript 放在 `skills/<skill-name>/scripts/`，提交到 Git 并进入 skill hash。
3. `sync:*` 显式写入生成产物；`check:*` 在临时目录重建并逐字节比较，不在检查期间修改产物。
4. 分发产物只能依赖目标运行时和已打包内容，不能要求使用者安装主仓库 Bun、pnpm、TypeScript 或源码依赖。
5. `pack:skills` 只收集已经通过生成状态检查的 skill 目录 Git blob，不在打包阶段临时构建未提交脚本。

`decision-records` CLI 的维护入口：

1. 源码：`scripts/decision-records/src/`。
2. 测试和夹具：`scripts/decision-records/tests/`。
3. 构建入口：`scripts/decision-records/build.ts`。
4. 分发产物：`skills/decision-records/scripts/decision-records.mjs`。
5. 同步：`bun run sync:decision-records-cli`。
6. 检查：`bun run check:decision-records-cli`。
7. 测试：`bun run test:decision-records-cli`。

## Skill 自更新脚本

每个 skill 包内包含 `scripts/update-skill.cjs`。该脚本用于已安装 skill 的自检和可选更新：它读取脚本内的配置项，从 `zxyycom/skills` 的 GitHub latest release 下载 `skill-package-lock.json`，用其中当前 skill 的独立 hash 与本地目录指纹比较；只有发现不一致并确认更新时，才下载对应 `<skill-name>.zip` asset，使用 `fflate` 解压出包内 `<skill-name>/` 目录并覆盖更新。指定旧 release tag 且该 release 没有 lock asset 时，脚本回退为下载 zip 并计算远端指纹。

自更新脚本源码使用主仓库 TypeScript 工具链和依赖，但分发产物应能脱离主仓库运行，不能要求已安装 skill 的使用者具备主仓库 Bun、pnpm 或 TypeScript 工具链。需要访问私有仓库或提高 GitHub API 限额时，可通过 `GITHUB_TOKEN` 或 `GH_TOKEN` 提供 token。

生成后的 `update-skill.cjs` 主体不要求保持源码可读性；顶部必须遵循统一生成头契约，并补充默认 package lock asset 和默认 release asset。`--help` 和正常运行输出也要显示仓库、可维护源码、skill 源目录和 release 输入，方便使用者在脚本报错时定位应修改的源文件，而不是直接修改打包后的 CJS 产物。

维护方式：

1. 通用源码只改 `scripts/templates/update-skill.ts`。
2. 运行 `bun run sync:skill-updaters` 将模板按各 skill 的 repo、ref 和 source path 渲染后打包到 `skills/<skill-name>/scripts/update-skill.cjs`。
3. `bun run check` 会执行 `check:skill-updaters`，避免已分发脚本与主仓库模板漂移。
4. 生成脚本进入 skill zip，因此会改变对应 skill hash 和聚合 hash；提交前 hook 会更新并 stage `skill-package-lock.json`。

已安装 skill 可在对应 skill 目录内运行：

```bash
node scripts/update-skill.cjs --check
node scripts/update-skill.cjs
node scripts/update-skill.cjs --yes
node scripts/update-skill.cjs --release-tag 20260701T085839Z-33304575c8da --check
```

## Git hooks

主仓库保留 `.githooks/pre-commit`。新 clone 或 hooksPath 丢失时，在主仓库运行 `bun run setup-hooks`，它会设置主仓库 `core.hooksPath`，并把 pre-commit hook 文件设为可执行。

主仓库 pre-commit hook 负责：

1. 运行 `bun scripts/hash-skills.ts --write --quiet` 写回根目录 `skill-package-lock.json`；没有 hash 或 lock 内容变化时保持静默。
2. 仅当 `skill-package-lock.json` 相对 Git index 有变化时自动 stage，让 hash manifest 和当前 staged 的 skill 内容进入同一个提交。

GitHub Actions 运行在提交之后，不能取消或修改已经 push 的提交。CI 只能在 hash 不一致时失败；如果需要阻止错误提交进入 `main`，应通过 GitHub branch protection 或 ruleset 要求相关 check 通过，并限制直接 push。

## CI 标准

GitHub CI 复用本地入口：

1. 安装 Bun，用于执行 TypeScript 脚本。
2. 安装 pnpm，用于依赖安装。
3. 运行 `pnpm install --frozen-lockfile`。
4. 运行 `bun run check`。
5. 运行 `bun scripts/hash-skills.ts --check --github-output`，校验根目录 `skill-package-lock.json` 是否匹配当前 skill 打包输入，并把当前聚合 hash 写入 job outputs。
6. 从 `github.event.before` 读取上一提交的 `skill-package-lock.json` 中的 `aggregateHash`；当前聚合 hash 与上一提交聚合 hash 不同时，认为需要发布新的版本化 release 并更新 latest 兼容入口。
7. 上传 `dist/*` 作为 workflow artifact，包含全部 skill zip 和 `skill-package-lock.json`，方便从单次运行中排查制品与单 skill hash。
8. 对 `main` 分支的 `push`，仅当当前 hash 与上一提交 hash 不一致时发布 GitHub Release `<timestamp>-<hash12>`，并同步更新 `skills-latest`；`workflow_dispatch` 作为手动重发入口。
9. Release 更新成功后，CI 上传全部 `dist/*`，不向 `main` 写回发布状态提交。

CI 发布使用 UTC 时间戳和内容 hash 生成版本化 release tag：格式为 `<timestamp>-<hash12>`，例如 `20260701T085839Z-33304575c8da`；`<hash12>` 是当前 `skill-package-lock.json` 中 `aggregateHash` 的前 12 位。该版本化 release 是 GitHub Releases 列表里的真实发布记录，并显式标记为 Latest。固定 `skills-latest` release 只作为兼容下载入口继续维护，tag 指向最新发布提交，assets 覆盖为当前全部 skill zip 和 `skill-package-lock.json`，但不作为发布时间语义来源。PR 只运行校验、打包、hash 校验和 artifact 上传，不发布 release。只改 `docs/skills/`、主仓库维护文档、脚本或 CI 时，hash 不变，CI 不发布新的版本化 release，也不覆盖 latest release。
