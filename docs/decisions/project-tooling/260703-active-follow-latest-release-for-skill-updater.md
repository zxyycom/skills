# 2026-07-03 - 自更新脚本跟随 latest release 制品

## 状态
- 当前状态: active
- 导致状态变化的决策: 无
- 状态说明: 作为 skill 自更新脚本默认远端来源的当前依据。

## 问题
- 自更新脚本原来默认从主仓库 `main` 分支下载源码 zip 并截取 `skills/<skill-name>/` 目录。
- 这种做法会让已安装 skill 跟随尚未发布的源码状态, 和主仓库通过 release 交付 skill zip 的契约不一致。
- 使用者执行更新时更应该获得已经通过 CI 校验、打包并发布的制品。

## 决定
- 采用: `scripts/update-skill.cjs` 默认通过 GitHub Releases API 读取 `zxyycom/skills` 的 latest release, 并下载其中对应的 `<skill-name>.zip` asset。
- 采用: release asset 解压后以包内 `<skill-name>/` 目录作为远端 skill 内容, 再和本地目标目录计算指纹并决定是否更新。
- 采用: 保留 `--release-tag <tag>` 作为排查和复现入口, 但默认不要求使用者传入 tag。
- 不采用: 继续默认读取 `main` 分支源码 zip; 这会绕过 release 作为正式交付入口的边界。
- 触发条件: 后续只要本仓库仍通过 GitHub Release 交付 skill zip, 自更新脚本默认就跟随 latest release asset。

## 影响
- 自更新脚本检查到的是最新已发布 skill 制品, 不再是 `main` 上的即时源码。
- 修改 skill 本体后, 只有 release 完成并包含新 zip asset, 已安装 skill 的自更新才会看到新版本。
- updater 生成配置仍可保留源码目录链接作为维护定位, 但远端更新输入是 release asset。

## 验证
- `scripts/templates/update-skill.ts` 通过 GitHub Releases API 下载 release asset。
- `scripts/sync-skill-updaters.ts` 生成的配置包含 `<skill-name>.zip` asset 名称。
- `bun run check` 覆盖 updater 生成状态检查、项目校验和 skill 打包。
