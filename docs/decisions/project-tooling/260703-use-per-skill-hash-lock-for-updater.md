# 2026-07-03 - 用 skill package lock 承接发布和自更新

## 索引摘要
- 目的: 让聚合发布中的每个 skill 能按自身内容准确判断是否需要更新。
- 背景: 主仓库采用聚合 release，只要任一 skill 的打包输入变化，就会发布一次包含全部 skill zip 的 release。
- 决策: 根目录只保留 `skill-package-lock.json`，记录聚合 hash 和每个 skill 的独立包内容 hash。

## 目的
- 让聚合发布中的每个 skill 能按自身内容准确判断是否需要更新。

## 背景
- 主仓库采用聚合 release，只要任一 skill 的打包输入变化，就会发布一次包含全部 skill zip 的 release。
- 已安装 skill 的自更新判断如果只感知 latest release 变化，容易把“聚合发布发生了”误解为“当前 skill 需要更新”。
- 单独保留 `skill-package.hash` 会和 `skill-package-lock.json` 中的聚合 hash 重复，增加同步和解释成本。
- 需要在保留聚合发布入口的同时，让一个状态文件同时支持聚合发布门禁和单 skill 更新判断。

## 决策
- 采用: 根目录只保留 `skill-package-lock.json`，记录聚合 hash 和每个 skill 的独立包内容 hash。
- 采用: 删除 `skill-package.hash`；CI 发布门禁、版本化 tag hash 和本地提交前 hook 都读取或写回 `skill-package-lock.json`。
- 采用: `scripts/pack-skills.ts` 将 `skill-package-lock.json` 复制到 `dist/`，CI 将它和全部 skill zip 一起作为 release asset 发布。
- 采用: 自更新模块 `scripts/update-skill.mjs` 默认先读取 release 中的 `skill-package-lock.json`，只比较当前 skill 的 hash；hash 不一致且确认更新时再下载对应 `<skill-name>.zip`。
- 采用: 指定旧 release tag 且该 release 没有 `skill-package-lock.json` 时，自更新脚本回退为下载 zip 并计算远端指纹，保留排查旧版本的能力。
- 不采用: 为每个 skill 建独立 release；当前仍以主仓库聚合 release 作为交付入口，避免重新引入多仓库或多 release 的维护成本。
- 不采用: 同时保留 `skill-package.hash` 和 `skill-package-lock.json`；两者会重复记录聚合 hash，且 lock 已能承接全部当前用途。

## 关系
- 修订: [使用 skill hash 门禁 latest release 发布](260701-gate-latest-release-by-skill-hash.md)
- 修订: [使用版本化 release 发布 skill 制品](260701-publish-versioned-skill-releases.md)
- 修订: [用 Git hook 更新 package hash](260701-update-package-hash-with-git-hooks.md)
