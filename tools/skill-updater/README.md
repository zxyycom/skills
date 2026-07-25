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
7. 更新只覆盖 zip 中出现的路径，不删除远端包中不存在的本地文件；同名本地文件的自定义内容会被覆盖。
8. 默认目标目录相对分发模块自身的 `import.meta.url` 定位，不受导入方入口影响。
9. 私有仓库或更高 GitHub API 限额使用 `GITHUB_TOKEN` 或 `GH_TOKEN`。

分发模块可被导入而不执行 CLI。公共 exports 是 `skillUpdaterConfig` 和返回退出码的 `runSkillUpdaterCli(argv)`。

## 维护与分发

1. 运行时源码位于 `src/`，公共声明源位于 `api/`，测试位于 `tests/`。
2. `scripts/build/skill-updaters.ts` 按 `skills/` 发现结果注入 repo、source path、release manifest 和 zip asset 配置。
3. 每个 skill 只保存生成的 `scripts/update-skill.mjs`、`update-skill.d.mts` 和 source map；产物可脱离主仓库的 Bun、pnpm、TypeScript 和源码依赖运行。
4. 生成头和 `--help` 输出必须提供仓库、维护源码、skill 源目录、release manifest、release asset 和重建入口，维护者不直接修改分发产物。

维护命令：

```bash
bun run test:skill-updater
bun run sync:skill-updaters
bun run check:skill-updaters
```

`sync:skill-updaters` 会改变每个 skill 的生成文件，因此可能改变多个 skill hash；`check:skill-updaters` 只读检查生成漂移。

## 已安装 skill 的入口

在对应 skill 目录运行：

```bash
node scripts/update-skill.mjs --check
node scripts/update-skill.mjs
node scripts/update-skill.mjs --yes
node scripts/update-skill.mjs --release-tag <tag> --check
```
