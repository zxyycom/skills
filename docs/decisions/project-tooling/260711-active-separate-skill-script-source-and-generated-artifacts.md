# 2026-07-11 - 分离 skill 分发脚本源码与生成产物

## 状态
- 当前状态: active
- 导致状态变化的决策: 无
- 状态说明: 作为需要随 skill 分发的编译脚本之源码 owner、生成位置、追溯信息和交付门禁使用。

## 问题
- 已安装 skill 需要携带能由目标运行时直接执行的 JavaScript，但直接在 `skills/<skill-name>/scripts/` 维护打包代码会失去正常的 TypeScript 模块结构、类型检查和测试入口。
- skill zip 只收集 `skills/<skill-name>/` 的 Git index 内容，因此可执行产物仍要进入 skill 目录，并与仓库源码保持确定性同步。
- 生成文件如果只写“不要编辑”，使用者在排查问题时仍无法直接找到源码、仓库和重建入口。

## 背景与约束
- 自更新脚本已经采用主仓库 TypeScript 模板与 skill 内 CJS 产物分离的方式。
- 分发产物必须脱离主仓库的 Bun、pnpm、TypeScript 和源码目录运行。
- 生成结果会进入 skill package hash；构建头不能包含时间戳、本机绝对路径或其他非确定性内容。

## 决定
- 采用: 在主仓库 `scripts/` 下按工具建立源码目录，承接 TypeScript 模块、测试、夹具和构建入口；skill 目录只承接实际分发所需的生成 JavaScript。
- 采用: 生成产物提交到 `skills/<skill-name>/scripts/`，由 `sync:*` 显式写入，由 `check:*` 在临时目录重建并比较，打包阶段只收集已经通过同步检查的稳定产物。
- 采用: 可嵌入注释的生成脚本顶部统一写明禁止直接编辑、仓库链接、线上可维护源码链接、仓库内源码路径、对应 skill 源目录和重建命令；按产物用途补充 release asset 等必要入口。
- 采用: 生成头保持确定性，不写生成时间、本机路径、随机标识或当前提交以外的临时状态。
- 采用: `decision-records` CLI 首先迁入 `scripts/decision-records/`，生成 `skills/decision-records/scripts/decision-records.mjs`；skill updater 同步复用相同的生成头契约。
- 采用: JSON 等不能嵌入注释的机器制品继续通过稳定文件名、生成入口和工具链 owner 文档追溯，不破坏其格式契约。
- 不采用: 在 skill 包内同时维护 TypeScript 源码和编译产物。源码、测试和构建配置不属于已安装 skill 的执行输入，会扩大分发面并产生双重 owner。
- 不采用: 只在 `pack:skills` 运行期间临时编译未提交产物。当前 hash 和 zip 读取 Git index，这种做法会让校验、发布状态和实际制品失去同一输入基线。
- 触发条件: 后续新增或调整任何需要编译后随 skill 分发的脚本时，沿用源码目录、生成产物、追溯头和同步检查契约。

## 影响
- 维护者修改正常结构的 TypeScript 源码并运行测试，不再直接编辑 skill 内的生成 JavaScript。
- 已安装 skill 仍只携带可以直接执行的 JavaScript，不需要主仓库开发工具链。
- 生成产物可以从文件自身定位仓库、源码和重建方式，排查入口不依赖额外上下文。
- 源码变化只有在同步后的 skill 产物发生变化时才改变 skill hash 和 release 输入。

## 验证
- `scripts/lib/generated-file.ts` 统一生成可追溯文件头。
- `scripts/decision-records/` 包含 CLI TypeScript 源码、构建入口、测试和夹具。
- `bun run check:decision-records-cli` 与 `bun run check:skill-updaters` 检查 skill 内生成产物没有漂移。
- `bun run test:decision-records-cli` 同时验证源码行为、Node 分发产物和生成头字段。
- `bun run check` 在打包前运行类型检查、生成状态检查、CLI 测试和项目校验。
