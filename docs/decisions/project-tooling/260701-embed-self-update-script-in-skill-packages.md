# 2026-07-01 - 在 skill 包内分发自更新脚本

## 索引摘要
- 背景: 仅依赖外部安装器时，已有 skill 目录的覆盖更新、内容一致性检查和多客户端目录适配都缺少稳定 owner。
- 决策: 主仓库维护通用 TypeScript 模板 `scripts/templates/update-skill.ts`，模板使用 `fflate` 解压 GitHub zip，并实现远端指纹检查、交互确认和覆盖更新。

## 背景
- 仅依赖外部安装器时，已有 skill 目录的覆盖更新、内容一致性检查和多客户端目录适配都缺少稳定 owner。
- 在主仓库维护本机目录同步脚本会把本机客户端目录结构纳入主仓库长期契约，范围过大。
- 已安装 skill 如果能随包携带一个自更新入口，就可以把“检查远端是否变化、是否覆盖更新”的操作留给使用者在本地显式执行。

- 主仓库仍是跨 skill 共享校验、打包和聚合发布的 owner。
- 子仓库 skill zip 只包含 `skill/<skill-name>/` 内文件，因此要让更新入口随 skill 分发，脚本必须进入每个 skill 目录。
- 各 skill 的更新逻辑相同，差异只在 GitHub repo、release asset 和 source path。
- 自更新脚本源码可以使用主仓库 TypeScript 工具链和依赖，但分发产物应能脱离主仓库运行，不能要求已安装 skill 的使用者具备主仓库 Bun、pnpm 或 TypeScript 工具链。

## 决定
- 采用: 主仓库维护通用 TypeScript 模板 `scripts/templates/update-skill.ts`，模板使用 `fflate` 解压 GitHub zip，并实现远端指纹检查、交互确认和覆盖更新。
- 采用: 主仓库维护 `scripts/sync-skill-updaters.ts`，根据 skill 发现结果渲染配置，并通过 Bun 默认 `--minify` 打包生成各 skill 包内压缩后的 `scripts/update-skill.cjs`，不支持多种压缩方案。
- 采用: 生成脚本内只固化 `skillName`、`repo`、`releaseAssetName` 和 `sourcePath` 配置项；主体逻辑由模板统一维护。
- 采用: 生成脚本顶部和 `--help` 输出写明主仓库 TypeScript 模板的 GitHub raw 链接，以及该 skill 对应的 GitHub 源目录，避免使用者在排查脚本问题时误改打包产物。
- 采用: `bun run check` 增加 updater 生成状态检查，避免各 skill 包内副本与模板漂移。
- 不采用: 继续维护一个主仓库本机目录同步脚本直接操作 `.codex/skills`、`.claude/skills` 或 `.cc-switch/skills`；这会扩大主仓库对用户本机目录的 owner。
- 不采用: 依赖外部安装器完成已有目录覆盖更新；当前安装器更适合首次安装和目录存在性检查。
