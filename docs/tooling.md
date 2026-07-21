# 项目工具链

本文档是主仓库脚本、依赖安装、校验、打包和 CI 的 owner 文档。README 只保留入口说明，AGENTS 只记录长期项目边界，具体工具链标准在这里维护；实现代码的通用质量规则由 [编码规范](coding-style.md) 承接。

## 职责边界

本文件负责：

1. package scripts 的用途和命名。
2. pnpm 与 Bun 的职责分工。
3. `scripts/` 下共享自动化脚本的目录、依赖、运行和生成约束。
4. 本地校验、打包和可交付制品规则。
5. GitHub CI 如何复用本地入口并发布全部 skill 制品。
6. `skills/` 单仓库布局下的 hash、hook 和自更新脚本规则。

本文件不负责 skill 行为、引用内容、决策记录格式、实现代码的通用质量规则或 agent 项目级协作规则。

## 分发定位

仓库为何集中维护、使用者如何选择 skill，以及轻量分发的产品边界由 [仓库模型](repository-model.md) 承接。本文件只定义对应机制：

1. 共享脚本统一发现和处理 `skills/` 下的内容，但每个 skill 仍分别形成 zip、独立内容 hash 和 updater 配置。
2. 聚合 release 从同一入口发布全部当前 skill 制品。
3. updater 由使用者显式运行，只检查和可选替换当前 skill。

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
3. `bun run hash:skills`: 计算当前 Git index 中所有 skill 打包输入的聚合 SHA-256 hash 和单 skill hash，并与根目录 `skill-package-lock.json` 对比；传入 `--write` 时写回当前状态，传入 `--check` 时不一致则失败，传入 `--quiet` 时只在 hash 或 lock 内容变化时输出。
4. `bun run pack:skills`: 读取 Git index 中 `skills/<skill-name>/` 的 blob，将每个 skill 分别打包为 `dist/<skill-name>.zip`，并把 `skill-package-lock.json` 复制为 release manifest asset。
5. `bun run setup-hooks`: 将主仓库 `core.hooksPath` 设置为 `.githooks`。
6. `bun run test:generated-file`: 测试生成文件共享能力，覆盖 Bun source map 的临时目录解析、仓库相对路径归一化和越界拒绝。
7. `bun run test:decision-records-cli`: 使用独立夹具测试 `decision-records` TypeScript 源码和包内 MJS；CLI 场景默认直接调用分发模块，只用 Node 子进程证明成功与失败入口。
8. `bun run test:skill-validator`: 使用临时 skill 目录测试结构校验源码、包内 MJS 导入、Node CLI、类型声明、失败诊断和生成头。
9. `bun run test:test-evidence-cli`: 从预构建 Git fixture 物化隔离 worktree，测试正则采集、外部清单接入、纯账本 API 与两层组合，并用 Node 子进程证明两套 CLI 的成功与失败入口。
10. `bun run test:skill-updater`: 使用本地假 GitHub 响应和临时目录测试 updater 的包内 MJS 导入、Node CLI、lock、zip 指纹、更新替换和失败诊断。
11. `bun run sync:decision-records-cli`: 从 `scripts/decision-records/` 构建并写入 skill 内的 `scripts/decision-records.mjs`、类型声明、source map 和索引 JSON Schema。
12. `bun run check:decision-records-cli`: 在临时目录构建 CLI，并检查 skill 内分发产物是否与当前源码一致。
13. `bun run sync:skill-validator`: 从 `scripts/skill-validator/` 构建并写入 `skill-maintainer` 内的 `scripts/validate-skill.mjs`、类型声明和 source map。
14. `bun run check:skill-validator`: 在临时目录构建结构验证器，并检查 skill 内分发产物是否与当前源码一致。
15. `bun run sync:test-evidence-cli`: 从 `scripts/test-evidence/` 构建并写入 `test-evidence-review` skill 内的正则采集与纯账本 CLI、source map、JSON Schema 与 Schema 派生类型声明。
16. `bun run check:test-evidence-cli`: 在临时目录重建测试证据两套 CLI 和全部 Schema 派生产物，并检查分发内容是否与当前源码一致。
17. `bun run sync:test-evidence-fixture`: 从可审查的 fixture 源生成包含固定 SHA-1 提交历史的 Git bundle。
18. `bun run check:test-evidence-fixture`: 重建 fixture 的确定性提交历史，并检查 bundle 暴露的 head 是否仍与源一致。
19. `bun run sync:skill-updaters`: 按主仓库模板和 `skills/` 发现结果生成各 skill 内的 `scripts/update-skill.mjs`、类型声明和 source map。
20. `bun run check:skill-updaters`: 检查各 skill 内的 updater MJS、类型声明和 source map 是否由当前主仓库模板生成。
21. `bun run test:check`: 在进程内测试完整检查的并发解析、失败停止和已启动任务等待。
22. `bun run check`: 通过 `scripts/check.ts` 运行全部前置检查，成功后打包全部 skill。
23. `bun run test:investigation-report-check`: 使用临时调查集合测试默认全量检查、主题与报告筛选、Markdown AST 标题、根目录额外 Markdown、首次形成时间与调查段形成时间、索引路径与投影、失败诊断、包内导入和 Node CLI。
24. `bun run sync:investigation-report-check`: 从 `scripts/investigation-report/` 构建并写入 `investigation-report` skill 内的 `check-investigations.mjs`、类型声明和 source map。
25. `bun run check:investigation-report-check`: 在临时目录重建调查报告检查器，并检查 skill 内分发产物是否与当前源码一致。

需要直接排查脚本问题时，可以用 `bun scripts/<script>.ts` 运行单个脚本。

## 脚本标准

1. 脚本使用 TypeScript 编写，放在主仓库 `scripts/`。
2. 根目录 `tsconfig.json` 是脚本 IDE 类型提示和 `tsgo` 的统一配置；脚本依赖 Node 类型，运行仍由 Bun 负责。
3. 顶层脚本只保留命令编排和输出；跨脚本共享能力放在 `scripts/lib/`，具体校验项放在 `scripts/validators/`。
4. `scripts/check.ts` 是完整检查的编排 owner；默认最多并发两个顶层任务，可通过 `CHECK_CONCURRENCY=<正整数>` 覆盖。前置任务失败后停止领取新任务并等待已启动任务；`pack:skills` 只在全部前置任务成功后执行。
5. 脚本优先覆盖所有 skill 的共同规则；确实存在 skill 专属规则时，在脚本中集中声明。
6. 脚本处理常见行为时优先使用高质量、高热度、维护活跃且有类型支持的库；只有规则属于本仓库领域约束时才在脚本中直接实现。
7. 脚本默认只读写主仓库内路径；临时打包产物输出到 `dist/`，需要随 skill 分发的生成脚本通过显式 `sync:*` 写入对应 skill，并由配套 `check:*` 检查漂移。
8. 外部 JSON 在边界完成运行时收窄；同一结构由多个入口消费或需要稳定字段诊断时，以 `valibot` schema 为结构真源，源码类型使用 `InferOutput` 推导。需要跨语言契约时从同一 Schema 生成 JSON Schema，再从 JSON Schema 生成分发 TypeScript 数据声明；不从手写 TypeScript 类型反向生成 Schema。
9. 多子命令 CLI 的命令、参数、帮助和非法参数诊断由 `commander` 承接；短小的单命令脚本使用 Node 标准参数解析能力。
10. 文件发现使用 `fast-glob`，避免在多个脚本中维护递归目录遍历。
11. Skill frontmatter 使用 `yaml` 解析，避免手写 YAML 字符串解析。
12. 打包脚本使用 `fflate` 生成 zip，只打包 `skills/<skill-name>/` 内文件，不把项目文档、CI、脚本或仓库元数据放进 skill zip；每次打包前清空 `dist/`，避免残留旧 skill 制品。
13. Markdown 链接提取使用 `mdast-util-from-markdown` 解析 Markdown AST；脚本负责仓库路径、决策关系和项目约束校验。
14. Markdown 内部链接目标必须是仓库内路径且目标存在；`#anchor` 必须匹配目标 Markdown 文件中的标题锚点。
15. 决策记录的独立入口和总校验直接复用 `scripts/decision-records/src/` 的同一套源码；skill 结构总校验和分发验证器直接复用 `scripts/skill-validator/src/`。分发模块由逐字节生成检查、包内导入测试和 Node CLI 集成测试覆盖，避免仓库校验依赖生成文件或形成第二套规则。
16. Skill 发布 hash 和 skill zip 都只覆盖会进入 skill zip 的文件路径和 Git blob 内容；`docs/skills/` 介绍页、项目文档、脚本和 CI 变化不直接触发 skill release。仓库脚本源码变化需要先同步为 skill 内生成产物，只有分发产物发生变化时才改变对应 hash。Hash 计算和打包都读取 Git index 中的 blob，避免 Windows 与 Linux 工作区换行差异导致本地 hook、CI 和 release asset 结果不一致。根目录 `skill-package-lock.json` 是唯一发布状态文件，记录聚合 hash 和每个 skill 的独立 hash。
17. 校验脚本不解析 workflow 结构, 也不通过正则检查 workflow 内部步骤; workflow 逻辑由文档约定、代码审查和 GitHub Actions 实际运行结果验证。
18. Skill 自更新脚本的通用逻辑由主仓库 `scripts/templates/update-skill.ts` 入口及 `scripts/templates/update-skill/` 模块承接；各 skill 包内只保留打包生成的 `scripts/update-skill.mjs`、`update-skill.d.mts` 和 source map。
19. 可嵌入注释的生成模块和声明顶部必须写明禁止直接编辑、仓库链接、线上可维护源码链接、仓库内源码或声明源路径、对应 skill 源目录和重建命令；按产物用途补充 release asset 等必要入口。生成头不写时间戳、本机绝对路径或其他非确定性状态。不能嵌入注释的 JSON 等机器制品由稳定生成入口和本文件承接追溯关系。

## Skill 分发脚本

需要编译后随 skill 分发的脚本采用源码与产物分离：

1. TypeScript 源码、公共声明源、测试、夹具和构建入口放在主仓库 `scripts/<tool-name>/`。
2. 构建后的自包含单文件 ESM 使用 `.mjs`，与同名 `.d.mts` 和 linked source map 一起放在 `skills/<skill-name>/scripts/`，提交到 Git 并进入 skill hash；map 内源码路径统一为仓库相对 POSIX 路径。
3. `.mjs` 导入时不得执行 CLI、修改退出状态或触发文件和网络操作；只有作为主模块运行时才进入 CLI。公共核心函数返回结构化结果，`run*Cli(argv)` 返回退出码并保留 CLI 输出语义。
4. `.d.mts` 描述对应 `.mjs` 的稳定公共 exports；函数声明源随 TypeScript 源码接受类型检查。Schema 拥有的数据结构不在函数声明源中重复定义，而由构建入口生成独立数据声明；`sync:*` 显式写入 MJS、声明、Schema 和 source map，`check:*` 重建并逐字节比较。
5. 分发产物只能依赖目标运行时和已打包内容，不能要求使用者安装主仓库 Bun、pnpm、TypeScript 或源码依赖；产物主体可以压缩，维护和调试以文件头指向的源码和声明源为准。
6. `pack:skills` 只收集已经通过生成状态检查的 skill 目录 Git blob，不在打包阶段临时构建未提交脚本。

`decision-records` CLI 的维护入口：

1. 源码：`scripts/decision-records/src/`。
2. 声明源：`scripts/decision-records/decision-records.d.mts`。
3. 测试和夹具：`scripts/decision-records/tests/`。
4. 构建入口：`scripts/decision-records/build.ts`。
5. 分发产物：`skills/decision-records/scripts/decision-records.mjs`、`decision-records.d.mts`、`decision-records.mjs.map` 及 `skills/decision-records/references/decision-index.schema.json`。
6. 同步：`bun run sync:decision-records-cli`。
7. 检查：`bun run check:decision-records-cli`。
8. 测试：`bun run test:decision-records-cli`。

`test-evidence-review` CLI 的维护入口：

1. 源码：`scripts/test-evidence/src/`。
2. 函数声明源：`scripts/test-evidence/test-entry-regex.d.mts`、`test-evidence-ledger.d.mts`；数据声明由 `src/schemas.ts` 单向生成。
3. 测试：`scripts/test-evidence/tests/`。
4. Git fixture 源：`scripts/test-evidence/tests/fixture-source.ts`。
5. Git fixture 产物：`scripts/test-evidence/tests/fixtures/reviewed-workspace.bundle`。
6. Git fixture 构建入口：`scripts/test-evidence/tests/build-fixture.ts`。
7. CLI 构建入口：`scripts/test-evidence/build.ts`。
8. 分发 CLI：`skills/test-evidence-review/scripts/test-entry-regex.mjs`、`test-evidence-ledger.mjs`，以及各自 `.d.mts` 和 source map。
9. 分发数据契约：`skills/test-evidence-review/references/schemas/*.schema.json` 和 `scripts/*.types.d.mts`；二者都由 `src/schemas.ts` 生成。
10. CLI 同步：`bun run sync:test-evidence-cli`。
11. CLI 检查：`bun run check:test-evidence-cli`。
12. Fixture 同步与检查：`bun run sync:test-evidence-fixture`、`bun run check:test-evidence-fixture`。
13. 测试：`bun run test:test-evidence-cli`。

`skill-maintainer` 结构验证器的维护入口：

1. 源码：`scripts/skill-validator/src/`。
2. 声明源：`scripts/skill-validator/validate-skill.d.mts`。
3. 测试：`scripts/skill-validator/tests/`。
4. 构建入口：`scripts/skill-validator/build.ts`。
5. 分发产物：`skills/skill-maintainer/scripts/validate-skill.mjs`、`validate-skill.d.mts` 及 `validate-skill.mjs.map`。
6. 同步：`bun run sync:skill-validator`。
7. 检查：`bun run check:skill-validator`。
8. 测试：`bun run test:skill-validator`。

`investigation-report` 检查器的维护入口：

1. 源码：`scripts/investigation-report/src/`。
2. 声明源：`scripts/investigation-report/check-investigations.d.mts`。
3. 测试：`scripts/investigation-report/tests/`。
4. 构建入口：`scripts/investigation-report/build.ts`。
5. 分发产物：`skills/investigation-report/scripts/check-investigations.mjs`、`check-investigations.d.mts` 及 `check-investigations.mjs.map`。
6. 同步：`bun run sync:investigation-report-check`。
7. 检查：`bun run check:investigation-report-check`。
8. 测试：`bun run test:investigation-report-check`。

检查器默认校验调查根目录中的全部索引条目和报告；除索引外的 Markdown 文件都按报告检查。`--topic` 与 `--report` 只收窄本次结构检查，不改变报告、索引或调查状态。

已安装的 `skill-maintainer` 可在自身目录内运行，或使用脚本绝对路径验证其他 skill：

```bash
node scripts/validate-skill.mjs <skill-directory>
```

需要在现有 ESM 进程中复用时，直接从已安装 skill 的实际路径导入同一个 `validate-skill.mjs`；导入不会执行 CLI。模块导出 `validateSkillDirectory` 和 `runSkillValidatorCli`，相邻的 `validate-skill.d.mts` 提供 TypeScript 类型。

## Skill 自更新脚本

每个 skill 包内包含 `scripts/update-skill.mjs`、`update-skill.d.mts` 及 `update-skill.mjs.map`。该模块用于已安装 skill 的自检和可选更新：它读取模块内的配置项，从 `zxyycom/skills` 的 GitHub latest release 下载 `skill-package-lock.json`，用其中当前 skill 的独立 hash 与本地目录指纹比较；只有发现不一致并确认更新时，才下载对应 `<skill-name>.zip` asset，使用 `fflate` 解压出包内 `<skill-name>/` 目录并覆盖更新。指定旧 release tag 且该 release 没有 lock asset 时，模块回退为下载 zip 并计算远端指纹。

自更新脚本源码使用主仓库 TypeScript 工具链和依赖，但分发产物应能脱离主仓库运行，不能要求已安装 skill 的使用者具备主仓库 Bun、pnpm 或 TypeScript 工具链。需要访问私有仓库或提高 GitHub API 限额时，可通过 `GITHUB_TOKEN` 或 `GH_TOKEN` 提供 token。

生成后的 `update-skill.mjs` 主体不要求保持源码可读性；顶部必须遵循统一生成头契约，并补充默认 package lock asset 和默认 release asset。导入模块不会自动检查或更新，公共 exports 为 `skillUpdaterConfig` 和返回退出码的 `runSkillUpdaterCli(argv)`；默认目标目录按模块自身的 `import.meta.url` 定位，不受导入方入口影响。`--help` 和正常运行输出也要显示仓库、可维护源码、skill 源目录和 release 输入，方便使用者在模块报错时定位应修改的源文件，而不是直接修改打包产物。

维护方式：

1. 通用源码只改 `scripts/templates/update-skill.ts` 入口及 `scripts/templates/update-skill/` 下的职责模块。
2. 运行 `bun run sync:skill-updaters` 将模板按各 skill 的 repo、ref 和 source path 渲染后打包到 `skills/<skill-name>/scripts/update-skill.mjs`，并同步 `update-skill.d.mts` 和 source map。
3. `scripts/templates/update-skill/tests/` 使用包内直接导入、本地假响应和临时目录验证 MJS 与 Node CLI；运行入口是 `bun run test:skill-updater`。
4. `bun run check` 会执行生成漂移检查和 updater 集成测试。
5. 生成脚本进入 skill zip，因此会改变对应 skill hash 和聚合 hash；提交前 hook 会更新并 stage `skill-package-lock.json`。

已安装 skill 可在对应 skill 目录内运行：

```bash
node scripts/update-skill.mjs --check
node scripts/update-skill.mjs
node scripts/update-skill.mjs --yes
node scripts/update-skill.mjs --release-tag 20260701T085839Z-33304575c8da --check
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
9. Release 更新成功后，CI 上传全部 `dist/*`；更新固定 `skills-latest` 时先删除其中已有 assets，再上传当前完整资产集，避免已移除或重命名的 skill zip 残留；CI 不向 `main` 写回发布状态提交。

CI 发布使用 UTC 时间戳和内容 hash 生成版本化 release tag：格式为 `<timestamp>-<hash12>`，例如 `20260701T085839Z-33304575c8da`；`<hash12>` 是当前 `skill-package-lock.json` 中 `aggregateHash` 的前 12 位。该版本化 release 是 GitHub Releases 列表里的真实发布记录，并显式标记为 Latest。固定 `skills-latest` release 只作为兼容下载入口继续维护，tag 指向最新发布提交，assets 覆盖为当前全部 skill zip 和 `skill-package-lock.json`，但不作为发布时间语义来源。PR 只运行校验、打包、hash 校验和 artifact 上传，不发布 release。只改 `docs/skills/`、主仓库维护文档、脚本或 CI 时，hash 不变，CI 不发布新的版本化 release，也不覆盖 latest release。
