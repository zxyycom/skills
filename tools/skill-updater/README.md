# Skill Updater

`tools/skill-updater/` 是所有 skill 包内自更新模块的源码 owner。它读取正式 GitHub release，比较当前 skill 的独立版本，并在交互确认或显式 `--yes` 后把 release zip 中的文件覆盖写入本地 skill。远端没有同名路径的本地文件保持不变。

项目级生成、打包和 release 边界见 [项目工具链](../../docs/tooling.md)。

## 运行契约

1. 默认读取仓库 latest release；`--release-tag` 可以定位指定版本。
2. 配置中的 `skillName` 是预期 skill 身份。任何远端请求前先检查本地目标：目录不存在或为空时允许安装；其他目标必须是普通目录，包含普通 `SKILL.md`，且 frontmatter `name` 与预期身份一致。
3. 本地版本来自同一份 `SKILL.md` frontmatter 的 `metadata.version`，远端版本来自 release 中的 `skill-release-manifest.json`；updater 不读取或计算 package hash。
4. 远端与本地版本一致时返回成功；`--check` 发现缺失、未版本化或版本不同的目标时返回失败，但不下载 zip、不写文件。
5. 需要更新时下载对应 zip，并要求其中的 `SKILL.md` frontmatter `name` 与配置身份一致、`metadata.version` 与 release manifest 一致。zip 内每个文件必须一一映射到唯一的 skill 内相对路径；路径穿越、别名路径和当前平台上的重复目标会在写入前被拒绝。
6. 确认前分别列出将覆盖的现有文件和将新增的文件，并说明其他本地文件会被保留。普通更新需要交互确认，`--yes` 显式跳过确认但仍输出文件清单。
7. 更新只覆盖 zip 中出现的路径，不删除远端包中不存在的本地文件；同名本地文件的自定义内容会被覆盖，包括包内 TS 定制。
8. 默认目标目录由公开 `scripts/update-skill.ts` 显式传入自身的 `import.meta.url` 定位，不受 runtime 所处层级、当前目录或导入方入口影响。
9. release 查询、manifest 和 zip 下载共用同次运行解析的凭据；来源、降级和恢复方式见 [GitHub 认证](#github-认证)。
10. 普通更新失败会尝试用本次临时备份恢复已覆盖文件，并移除本次新增文件；此行为不保证进程被终止、系统崩溃或回滚本身失败时自动恢复。更新与依赖安装期间暂停领域操作，失败后核对当前文件状态再重试。

公开 TS 入口可被导入而不执行 CLI、下载或安装依赖。公共 exports 是 `skillUpdaterConfig`、`UpdaterConfig` 类型和返回退出码的 `runSkillUpdaterCli(argv)`。调用时先加载完整 updater 模块图，再进行覆盖；静态加载完成的模块允许本次运行更新其自身 TS 文件，后续运行使用新内容。

## GitHub 认证

本地目标校验通过后、首次请求前解析一次凭据，按以下优先级选择：

1. 去除首尾空白后的非空 `GITHUB_TOKEN`。
2. 去除首尾空白后的非空 `GH_TOKEN`。
3. `gh auth token --hostname github.com` 返回的当前登录凭据；显式主机名保证使用 github.com 账号，不受 `GH_HOST` 影响。

凭据去除首尾空白后应为不含空白的可打印 ASCII。环境变量格式非法时，在请求前报错，诊断仅说明格式要求。

gh 是可选依赖，凭据读取采用非交互调用，超时上限为 5 秒。未安装、执行失败（包括未登录）、超时或输出为空白、格式非法时，updater 在 stderr 说明原因、共享 IP 限额和恢复方式，再匿名访问公开 release。配置上述环境变量或执行 `gh auth login --hostname github.com` 可恢复认证。

help 和普通 import 不查询凭据；updater 不安装 gh 或启动交互登录。token 和 gh 原始输出不进入日志。已选凭据的 HTTP 请求失败时保留该错误，不匿名重试或切换身份。

命令语义见 [GitHub CLI 文档](https://cli.github.com/manual/gh_auth_token)，限流规则见 [GitHub REST API 文档](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)。

## 运行前置与恢复

知识型 skill 的指令使用不需要安装依赖；其 TS updater 和领域工具一样需要满足随包 manifest 声明的 Node 运行前置和兼容依赖。依赖使用 Node 正常解析，可复用兼容宿主环境，不要求 skill 内存在 `node_modules`，也不要求与随包锁文件精确版本相同。

需要独立安装、复现基线或修复依赖时，显式运行：

```bash
pnpm --dir "<skill-directory>" install \
  --ignore-workspace --prod --frozen-lockfile \
  --config.node-linker=isolated
```

普通 import、help、检查和更新均不隐式安装。公开入口在实际加载 runtime 失败时保留诊断，并给出上述安装命令；运行中的普通操作错误继续保留其原始诊断。安装失败时先按 pnpm 诊断恢复权限、网络或依赖，再重跑 frozen 安装；manifest/锁文件或运行时本身损坏时，重新获取完整 skill 后再安装并重试。

文件更新成功只说明源码已覆盖，不证明现有依赖适用于新源码。新包需要不同依赖时，在更新后显式执行 frozen 安装。已有自包含 MJS updater 可以安装当前 TS zip；完成后使用新的 TS 入口。保留在本地的旧入口不代表当前包继续支持它。

## 维护与分发

1. 运行时源码和公开类型位于 `src/`，测试位于 `tests/`。
2. `scripts/build/skill-updaters.ts` 提供无执行副作用的 entry/config factory；共享 skill 适配将领域和 updater 的入口、依赖及受管文件合并后一次同步，避免分别生成 manifest 或清理对方模块。
3. 每个 skill 保存公开 `scripts/update-skill.ts`、`scripts/runtime/tools/` 下所需自有 TS、独立 manifest/锁文件及忽略规则。第三方依赖不打入源码副本；安装状态、store 与缓存不进入正式制品。
4. 生成头和 `--help` 提供仓库、维护源码、skill 源目录、release manifest、release asset 和同步入口。仓库维护修改源码 owner 再同步；安装者可以直接修改包内 TS，无需构建，同名更新会覆盖定制。
5. 同步只清理仓库中显式退役或带受管标记的生成文件；这一维护动作不改变客户端“只覆盖正式 zip 路径、保留其他文件”的更新契约。

维护命令：

```bash
bun run test:skill-updater
bun run sync:skill-updaters
bun run check:skill-updaters
```

`sync:skill-updaters` 同步各 skill 的完整运行时，因此可能改变多个 skill hash；`check:skill-updaters` 只读检查生成漂移及 manifest/锁文件的直接依赖声明一致性，不代替真实 frozen 安装验证。

## 已安装 skill 的入口

在对应 skill 目录运行：

```bash
node scripts/update-skill.ts --check
node scripts/update-skill.ts
node scripts/update-skill.ts --yes
node scripts/update-skill.ts --release-tag <tag> --check
```
