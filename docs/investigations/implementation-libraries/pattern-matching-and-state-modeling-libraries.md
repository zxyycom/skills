# TypeScript 穷尽匹配与轻量状态建模库调查

## 调查信息
- 核心问题: 哪些 TypeScript 库适合预装，用于可靠表达封闭分支、判别联合和真正的有限状态机，同时保持轻量、成熟且持续维护？
- 状态: 已结束
- 最新报告时间: 2026-08-07T11:43:56+08:00

## 调查报告

### 确定穷尽匹配与轻量状态机的预装候选
- 形成时间: 2026-08-07T11:43:56+08:00

#### 形成时背景

仓库正在扩展 `docs/coding-style.md`，准备按问题形态给出实现模型。当前未提交草案把“状态和分支集合封闭”对应到判别联合、穷尽分支或状态机，并曾把 `ts-pattern`、XState 等外部库写成动态参考。使用者希望减少 agent 临时检索和安装依赖产生的网络开销，改为先比较轻量度、热度、生态和活跃度，再预装少量可靠库；即使暂时不用，也不让实现者临时选择未经调查的库。

调查基于仓库 commit `c8506725342ca22501995620b4f34b6053dc3397`，同时受未提交的 `docs/coding-style.md` 草案影响。仓库使用 Bun、pnpm 和 TypeScript native preview 7.0，当前 `package.json` 尚未包含本报告候选。XState 主包因使用者已确认过重而不进入推荐和安装候选。

#### 调查目的

本轮回答三个问题：

1. 简单封闭分支、判别联合辅助和深层模式匹配分别是否需要第三方库。
2. 真正需要状态、事件和合法转移约束时，是否存在值得通用预装的轻量状态机库。
3. 哪些候选可以直接进入预装清单，哪些只保留调查结论，以及哪些条件会改变当前判断。

调查不执行安装，不修改依赖、锁文件、源码或编码规范，也不验证候选在本仓库 TypeScript 7.0 preview 下的实际编译结果。

#### 调查范围与依据

快照时点为 2026-08-07（Asia/Shanghai）。纳入的穷尽匹配与判别联合候选为 `ts-pattern`、`match-iz`、`assert-never`、`@typemint/core` 和 `@praha/tagged`；纳入的状态机候选为 `robot3`、`@xstate/fsm`、`typescript-fsm` 和 `@zag-js/core`。前一组覆盖完整模式匹配、原生 `switch` 穷尽辅助和判别联合构造；后一组覆盖函数式 FSM、扁平异步 FSM、旧 XState 轻量实现和活跃的 UI 状态机实现。

比较口径如下：

- 版本、发布时间、发布包解压尺寸、生产依赖和 TypeScript 声明来自各包的 [npm registry 元数据](https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md)。
- 热度采用 2026-07-08 至 2026-08-06 共 30 个完整 UTC 日的 [npm downloads point API](https://github.com/npm/registry/blob/main/docs/download-counts.md) 下载量，以及 2026-08-07 读取的 GitHub stars。下载量可能包含 CI、镜像和传递依赖，不等同于独立使用者。
- 活跃度采用 npm 最新版本发布时间和 GitHub 默认分支最近提交时间；单仓多包项目使用候选所在目录的最近提交。`@xstate/fsm` 与 `@zag-js/core` 的 stars 是整个上游仓库的 stars，不能视为包级热度。
- 运行体积采用 [Bundlephobia](https://bundlephobia.com/) 对固定版本给出的 minified + gzip 估算；它适合横向比较，不代替本仓库实际打包、tree-shaking 和运行时测量。
- 能力、TypeScript 支持、文档与生态依据候选的官方 README、文档站、公开声明文件和官方集成。未安装候选，也未运行类型或行为样例。

#### 调查结果与边界

##### 语义边界

“封闭分支”和“状态机”不应由同一个库选择代替：

- 当结果只取决于当前值，目标是对判别联合做类型收窄、映射或穷尽分支时，使用原生 `switch`/`never` 或 `ts-pattern` 已经足够。
- 当行为同时取决于当前状态和事件，需要显式拒绝非法转移，并需要维护转移表、上下文、guard、动作、异步调用或解释器生命周期时，才属于真正状态机。
- `ts-pattern` 可以把 `[state, event]` 写成穷尽 reducer，但不提供机器解释器、转移图或生命周期语义，不能因此替代真正状态机库。

##### 穷尽匹配与判别联合量化对照

| 候选 | 版本与最新发布 | gzip 运行体积 / npm 解压尺寸 | 生产依赖 | 30 日下载 | GitHub stars | 最近相关提交 |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| [`ts-pattern`](https://www.npmjs.com/package/ts-pattern) | 5.9.0 / 2025-10-26 | [2,617 B](https://bundlephobia.com/package/ts-pattern@5.9.0) / 452,137 B | 0 | [23,420,635](https://api.npmjs.org/downloads/point/2026-07-08:2026-08-06/ts-pattern) | [15,113](https://github.com/gvergnaud/ts-pattern) | [2026-05-25](https://github.com/gvergnaud/ts-pattern/commit/c92ca435c7e1827e0fd55c539080ef1bfd6fe3f0) |
| [`match-iz`](https://www.npmjs.com/package/match-iz) | 5.1.1 / 2026-07-21 | [2,747 B](https://bundlephobia.com/package/match-iz@5.1.1) / 184,862 B | 0 | [283,891](https://api.npmjs.org/downloads/point/2026-07-08:2026-08-06/match-iz) | [176](https://github.com/shuckster/match-iz) | [2026-08-01](https://github.com/shuckster/match-iz/commit/7c6804382e7583b98fd2c772294d658a0f97fef9) |
| [`assert-never`](https://www.npmjs.com/package/assert-never) | 1.4.0 / 2024-12-17 | [311 B](https://bundlephobia.com/package/assert-never@1.4.0) / 5,775 B | 0 | [16,369,582](https://api.npmjs.org/downloads/point/2026-07-08:2026-08-06/assert-never) | [45](https://github.com/aikoven/assert-never) | [2024-12-17](https://github.com/aikoven/assert-never/commit/d55b0887a4c8336fe308c3d155a8d838efe0e9f0) |
| [`@typemint/core`](https://www.npmjs.com/package/@typemint/core) | 0.16.2 / 2026-06-26 | [1,442 B](https://bundlephobia.com/package/@typemint/core@0.16.2) / 285,664 B | 0 | [3,389](https://api.npmjs.org/downloads/point/2026-07-08:2026-08-06/@typemint/core) | [0](https://github.com/typemint-dev/typemint) | [2026-06-26](https://github.com/typemint-dev/typemint/commit/b811794e5c37d5173fa8275708e77ac22d843581) |
| [`@praha/tagged`](https://www.npmjs.com/package/@praha/tagged) | 1.0.0 / 2026-03-24 | [207 B](https://bundlephobia.com/package/@praha/tagged@1.0.0) / 17,808 B | 0 | [5,415](https://api.npmjs.org/downloads/point/2026-07-08:2026-08-06/@praha/tagged) | [1](https://github.com/praha-inc/tagged) | [2026-03-24](https://github.com/praha-inc/tagged/commit/aafe84ed6d9479aac038ba81a85c50caebacc39d) |

量化结果与官方能力说明共同支持以下判断：

- **建议预装 `ts-pattern`，且本类别只预装这一个库。** 它零生产依赖，gzip 约 2.6 KB，30 日下载约 2,342 万，15,113 stars，仍有 2026 年提交；[官方文档](https://github.com/gvergnaud/ts-pattern#readme)完整覆盖判别联合、嵌套对象、元组、guard、选择和 `.exhaustive()`。它能直接向 agent 表达“复杂封闭分支应保持穷尽、紧凑且可推断”的期待方向。官方同时说明 `.exhaustive()` 会增加类型检查工作量，因此简单分支仍可使用原生 `switch`。
- **`assert-never` 只保留为原生写法的生态基线，不建议与 `ts-pattern` 一起预装。** 它极小且下载量高，但[公开能力](https://github.com/aikoven/assert-never#readme)只是为 `switch` 默认分支包装一个 `never` 检查；TypeScript 本身即可表达同一约束，额外依赖不会提供复杂匹配能力。
- **`match-iz` 不作为 TypeScript 穷尽匹配候选。** 它近期活跃、零依赖且文档丰富，但其[官方 README](https://github.com/shuckster/match-iz#readme)明确说明 TypeScript 支持“very basic and incomplete”，核心定位是 JavaScript 动态模式匹配，不能兑现本轮最重要的编译期穷尽价值。
- **`@typemint/core` 与 `@praha/tagged` 暂不预装。** 前者提供构造、guard 和穷尽匹配，[能力范围](https://github.com/typemint-dev/typemint/tree/main/packages/core)也包含更多代数数据建模工具，但诞生不足四个月、仍为 0.x 且采用量很低；后者只有极小的 tagged-union 构造与收窄工具，[README 示例](https://github.com/praha-inc/tagged#readme)没有由库本身强制穷尽分支。两者当前生态证据不足以替代 `ts-pattern`。

##### 轻量状态机量化对照

| 候选 | 版本与最新发布 | gzip 运行体积 / npm 解压尺寸 | 生产依赖 | 30 日下载 | GitHub stars | 最近相关提交 |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| [`robot3`](https://www.npmjs.com/package/robot3) | 1.2.0 / 2025-09-20 | [1,270 B](https://bundlephobia.com/package/robot3@1.2.0) / 27,757 B | 0 | [5,150,903](https://api.npmjs.org/downloads/point/2026-07-08:2026-08-06/robot3) | [2,194](https://github.com/matthewp/robot) | [2025-12-11](https://github.com/matthewp/robot/commit/4cd08d1cb3f08c7d59ef90439ab965d81c001176) |
| [`@xstate/fsm`](https://www.npmjs.com/package/@xstate/fsm) | 2.1.0 / 2023-06-21 | [1,578 B](https://bundlephobia.com/package/@xstate/fsm@2.1.0) / 57,110 B | 0 | [20,762,014](https://api.npmjs.org/downloads/point/2026-07-08:2026-08-06/@xstate/fsm) | [29,977*](https://github.com/statelyai/xstate) | [2023-09-12](https://github.com/statelyai/xstate/commit/1153b3f9a95b4d76ff5408be8bd03a66f884b9cb) |
| [`typescript-fsm`](https://www.npmjs.com/package/typescript-fsm) | 1.6.0 / 2025-04-10 | [989 B](https://bundlephobia.com/package/typescript-fsm@1.6.0) / 31,068 B | 0 | [53,314](https://api.npmjs.org/downloads/point/2026-07-08:2026-08-06/typescript-fsm) | [301](https://github.com/WebLegions/typescript-fsm) | [2025-04-10](https://github.com/WebLegions/typescript-fsm/commit/37f6e5ab8369fc2dfba9d23b0e7400fd764afa84) |
| [`@zag-js/core`](https://www.npmjs.com/package/@zag-js/core) | 1.43.0 / 2026-07-29 | [2,621 B](https://bundlephobia.com/package/@zag-js/core@1.43.0) / 65,098 B | 2 | [5,339,254](https://api.npmjs.org/downloads/point/2026-07-08:2026-08-06/@zag-js/core) | [5,177*](https://github.com/chakra-ui/zag) | [2026-07-29](https://github.com/chakra-ui/zag/commit/b24c84b5fb676f2a77133c5fa0124ce5f684c91a) |

`*` 表示整个上游 monorepo 的 stars，而不是候选包单独获得的 stars。

当前**不建议通用预装状态机库**：

- **`robot3` 是最接近要求的保留候选，但还不足以无条件预装。** 它以函数式、不可变方式提供状态、转移、guard、context reducer、action、immediate transition、Promise/machine invoke 和解释器，[文档](https://thisrobot.life/)与 React 等集成、可视化工具均存在，体积、下载量、stars 和近期维护也良好。然而当前[声明文件](https://github.com/matthewp/robot/blob/4cd08d1cb3f08c7d59ef90439ab965d81c001176/packages/core/index.d.ts)仍把目标状态声明为普通 `string`，包含多处 `any` 和一处明确的类型 FIXME；它能推断部分事件名，但没有证据证明非法目标和全部事件载荷都能在编译期被拒绝。对于“减少复杂范式手写错误”这一目标，这个缺口需要先通过本仓库类型样例验证。
- **`typescript-fsm` 可作为扁平、异步流程的次选。** [官方 README](https://github.com/WebLegions/typescript-fsm#readme)提供泛型 state/event、表驱动转移和 Promise callback，约 1 KB gzip 前体积且零依赖；但 30 日下载仅 53,314，文档和集成主要集中在单一 README 与测试，模型也比 Robot3 窄。当前证据不足以把它设为所有状态机问题的预装默认。
- **`@xstate/fsm` 排除。** 虽然下载量高且体积小，[当前官方文档](https://stately.ai/docs/xstate-fsm)已经明确说明该包在 XState v5 中弃用并要求使用 XState；包目录和最新版本均停留在 2023 年。其下载和 XState monorepo stars 不能抵消维护状态。
- **`@zag-js/core` 不作为通用候选。** 它维护活跃、Schema 类型和[状态机文档](https://zagjs.com/guides/building-machines)完整，也支持 nested state、guard、action 和 effect；但官方定位是 UI component machine，执行时还需 `@zag-js/vanilla` 或框架 adapter，且包自身已有两个生产依赖。它适合采用 Zag UI 体系的项目，不适合当前 CLI/工具仓库的通用预装池。

##### 可执行结论

1. 本调查建议主线程把 **`ts-pattern` 作为唯一直接安装候选**，用于非平凡的封闭分支、判别联合组合和需要编译期穷尽检查的映射。
2. 简单单值分支继续使用 TypeScript 原生 `switch` + `never`；不额外安装 `assert-never`。
3. 状态机类别本轮不安装。`robot3` 保留为第一复查候选；当仓库出现真实的多状态、多事件、guard 或异步 invoke 用例时，先以该用例验证非法目标、事件载荷、Bun/TypeScript 7.0 preview 兼容性和测试表达，再决定是否预装。
4. `@xstate/fsm`、`match-iz`、`@typemint/core`、`@praha/tagged`、`typescript-fsm` 和 `@zag-js/core` 只保留本报告结论，不进入当前依赖清单。

本报告只形成推荐，没有执行安装或兼容性验证。npm 下载量、GitHub stars、维护状态或候选主版本发生显著变化，仓库采用 UI 状态机体系，或者出现能够代表真实状态机需求的实现任务时，应重新调查状态机候选；若安装 `ts-pattern`，仍需由依赖 owner 记录版本选择并运行仓库类型检查与全量验证。
