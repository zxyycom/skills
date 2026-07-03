# 2026-07-03 - 用 skill package lock 承接发布和自更新

## 状态
- 当前状态: active
- 导致状态变化的决策: 无
- 状态说明: 作为唯一发布状态文件、release manifest、单 skill hash 和自更新脚本判断边界的当前依据。

## 问题
- 主仓库采用聚合 release，只要任一 skill 的打包输入变化，就会发布一次包含全部 skill zip 的 release。
- 已安装 skill 的自更新判断如果只感知 latest release 变化，容易把“聚合发布发生了”误解为“当前 skill 需要更新”。
- 单独保留 `skill-package.hash` 会和 `skill-package-lock.json` 中的聚合 hash 重复，增加同步和解释成本。
- 需要在保留聚合发布入口的同时，让一个状态文件同时支持聚合发布门禁和单 skill 更新判断。

## 决定
- 采用: 根目录只保留 `skill-package-lock.json`，记录聚合 hash 和每个 skill 的独立包内容 hash。
- 采用: 删除 `skill-package.hash`；CI 发布门禁、版本化 tag hash 和本地提交前 hook 都读取或写回 `skill-package-lock.json`。
- 采用: `scripts/pack-skills.ts` 将 `skill-package-lock.json` 复制到 `dist/`，CI 将它和全部 skill zip 一起作为 release asset 发布。
- 采用: `scripts/update-skill.cjs` 默认先读取 release 中的 `skill-package-lock.json`，只比较当前 skill 的 hash；hash 不一致且确认更新时再下载对应 `<skill-name>.zip`。
- 采用: 指定旧 release tag 且该 release 没有 `skill-package-lock.json` 时，自更新脚本回退为下载 zip 并计算远端指纹，保留排查旧版本的能力。
- 不采用: 为每个 skill 建独立 release；当前仍以主仓库聚合 release 作为交付入口，避免重新引入多仓库或多 release 的维护成本。
- 不采用: 同时保留 `skill-package.hash` 和 `skill-package-lock.json`；两者会重复记录聚合 hash，且 lock 已能承接全部当前用途。
- 触发条件: 后续只要主仓库继续用聚合 release 发布多个 skill，自更新判断就以单 skill hash 为准，聚合 hash 只负责发布门禁和版本化 tag。

## 影响
- 任一 skill 更新仍会触发聚合 release，但未变化 skill 的 updater 会通过自己的 hash 判断为 current。
- release asset 除全部 `<skill-name>.zip` 外，还必须包含 `skill-package-lock.json`。
- `skill-package-lock.json` 成为唯一发布状态文件，不能作为临时产物忽略。

## 验证
- `scripts/hash-skills.ts` 生成和校验 `skill-package-lock.json`。
- `scripts/templates/update-skill.ts` 使用 release lock 中的单 skill hash 做更新判断。
- `.github/workflows/package-skills.yml` 上传 `dist/*`，覆盖 skill zip 和 lock manifest。
- `bun run check` 覆盖 updater 生成状态检查、项目校验和打包输出。
