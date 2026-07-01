# 2026-07-01 - 使用 tsgo 作为默认类型检查入口

## 状态
- 当前状态: active
- 导致状态变化的决策: 无
- 状态说明: 作为当前主仓库 TypeScript 脚本类型检查方式使用。

## 问题
- 主仓库脚本需要更好的 TypeScript 开发体验和更快的本地类型检查入口。
- 继续使用 `tsc` 作为默认入口不能体现用户希望引入 `tsgo` 的工具链方向。

## 决定
- 采用: 安装 `@typescript/native-preview`，并让 `bun run typecheck` 执行 `tsgo --noEmit`。
- 采用: `tsconfig.json` 继续作为 IDE 类型提示和 `tsgo` 的统一配置。
- 不采用: 保留 `typecheck:tsc` 或其他 `tsc` fallback 脚本；当前项目只维护一个默认类型检查入口。
- 触发条件: 后续主仓库脚本类型检查继续以 `tsgo` 为准；只有 `tsgo` 预览版不再适合项目时，才重新讨论类型检查工具。

## 影响
- `bun run check` 的类型检查阶段只依赖 `tsgo`。
- `typescript` 不再作为直接 devDependency 保留。
- `@typescript/native-preview` 是预览包，pnpm 需要记录对应版本的 release-age 例外配置。

## 验证
- `package.json` 中 `typecheck` 为 `tsgo --noEmit`，没有 `typecheck:tsc`。
- `bun run typecheck` 和 `bun run check` 通过。
