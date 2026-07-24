# Skill Updater

`tools/skill-updater/` 是所有 skill 包内自更新模块的源码 owner。它读取正式 GitHub release，比较当前 skill 的独立内容指纹，并在交互确认或显式 `--yes` 后用 release zip 中的对应目录替换本地 skill。

项目级生成、打包和 release 边界见 [项目工具链](../../docs/tooling.md)。

## 运行契约

1. 默认读取仓库 latest release；`--release-tag` 可以定位指定版本。
2. 远端存在 `skill-package-lock.json` 时，先读取其中当前 skill 的独立 hash；旧 release 缺少 lock asset 时，下载 zip 并计算远端指纹。
3. 远端与本地指纹一致时返回成功；`--check` 发现缺失或可更新目标时返回失败，但不写文件。
4. 普通更新需要交互确认，`--yes` 显式跳过确认。确认后才替换目标目录；存在 package lock 时，zip 在确认后下载并核对指纹，旧 release 缺少 lock 时可能先下载 zip 计算远端指纹。
5. 默认目标目录相对分发模块自身的 `import.meta.url` 定位，不受导入方入口影响。
6. 私有仓库或更高 GitHub API 限额使用 `GITHUB_TOKEN` 或 `GH_TOKEN`。

分发模块可被导入而不执行 CLI。公共 exports 是 `skillUpdaterConfig` 和返回退出码的 `runSkillUpdaterCli(argv)`。

## 维护与分发

1. 运行时源码位于 `src/`，公共声明源位于 `api/`，测试位于 `tests/`。
2. `scripts/build/skill-updaters.ts` 按 `skills/` 发现结果注入 repo、ref、source path 和 asset 配置。
3. 每个 skill 只保存生成的 `scripts/update-skill.mjs`、`update-skill.d.mts` 和 source map；产物可脱离主仓库的 Bun、pnpm、TypeScript 和源码依赖运行。
4. 生成头和 `--help` 输出必须提供仓库、维护源码、skill 源目录、package lock asset、release asset 和重建入口，维护者不直接修改分发产物。

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
