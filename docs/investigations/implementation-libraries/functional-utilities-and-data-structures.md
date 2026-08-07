# TypeScript 函数式工具与专用数据结构库调查

## 调查信息
- 核心问题: 在本仓库的 TypeScript 实现中，哪些函数式集合/管道工具与专用数据结构库值得预装，既能提供可靠实现又不会用重叠抽象扩大代码风格的解空间？
- 状态: 已结束
- 最新报告时间: 2026-08-07T11:43:20+08:00

## 调查报告

### 预装候选的适用价值与依赖边界
- 形成时间: 2026-08-07T11:43:20+08:00

#### 形成时背景

本仓库正在扩展编码规范，希望通过现成实现让 AI 更容易写出简洁、可靠的 TypeScript 代码。用户不希望 agent 在实现过程中临时联网搜索和动态安装依赖，接受少量库预先安装后保持未使用；候选仍需同时关注轻量度、热度、生态和活跃度。函数式偏好是需要支持的一种实现方向，但不能因为库已存在就让简单数据处理变成额外的抽象层。

当前仓库是私有的 Bun/Node TypeScript 工具工作区。形成报告时，`package.json` 尚未包含本报告中的候选库；`scripts/` 与 `tools/` 的实现大量使用原生 `Array`、`Map` 和 `Set`，未发现 Heap、Trie、LRU 等专用数据结构的既有使用。项目基线为 commit `c8506725342ca22501995620b4f34b6053dc3397`，`package.json`、`pnpm-lock.yaml`、`scripts/` 和 `tools/` 没有未提交改动影响这一观察。

#### 调查目的

本轮回答两个问题：

1. Remeda、es-toolkit、Radash、Ramda/Rambda 中，哪些适合成为预装的函数式集合、管道或通用工具，分别能支持怎样的代码方向；
2. 专用数据结构是否值得预装，若值得，Mnemonist 是否比原生结构、窄用途包或其他综合库更适合。

本轮只给出候选排序和使用边界，不安装依赖，不修改编码规范，也不调查 Result/Option、模式匹配或状态机库。

#### 调查范围与依据

外部指标观测于 2026-08-07（Asia/Shanghai）：

- 版本、发布时间、发布文件数、`dist.unpackedSize`、生产依赖、内置类型、ESM/exports 与 `sideEffects` 来自 [npm registry](https://registry.npmjs.org/) 的包元数据；`dist.unpackedSize` 表示完整安装展开体积，不等同于应用最终 bundle。
- 下载量来自 [npm downloads API](https://github.com/npm/registry/blob/main/docs/download-counts.md)，统一窗口为 2026-07-07 至 2026-08-05，共 30 个自然日；下载量包含 CI 和传递依赖，不等同于独立使用者数量。
- stars、最近默认分支活动和 release 来自各候选的 GitHub 官方仓库与 GitHub API；npm dependents 用作生态广度的辅助信号。stars 与 dependents 不是质量结论。
- TypeScript 体验、模块化、tree-shaking、API 定位和文档覆盖依据候选官方 README/文档。上游性能与 bundle 宣称没有在本仓库复测。
- 本地适用性通过读取 `package.json` 并在 `scripts/**/*.ts`、`tools/**/*.ts` 中检索原生集合、排序和专用数据结构使用情况判断。

函数式与通用工具实际比较了 [Remeda](https://github.com/remeda/remeda)、[es-toolkit](https://github.com/toss/es-toolkit)、[Radash](https://github.com/sodiray/radash)、其活跃后继 [Radashi](https://github.com/radashi-org/radashi)、[Ramda](https://github.com/ramda/ramda) 和 [Rambda](https://github.com/selfrefactor/rambda)。数据结构比较了 [Mnemonist](https://github.com/Yomguithereal/mnemonist)、窄用途的 [@datastructures-js/priority-queue](https://github.com/datastructures-js/priority-queue)，以及 [js-sdsl](https://github.com/js-sdsl/js-sdsl) 和 [data-structure-typed](https://github.com/zrwusa/data-structure-typed) 两个综合基线。

本轮没有安装候选，因而没有执行本仓库兼容性、类型推断、bundle、性能或供应链安全验证；这些属于采用后的验证义务。

#### 调查结果与边界

建议把 **Remeda** 列为函数式集合与管道方向的首选预装候选。它的价值不是替换所有原生数组操作，而是为确实由连续数据转换主导的代码提供 TypeScript 优先、data-first/data-last、惰性管道和可 tree-shake 的统一表达。它在四项指标上都达到可采用水平，且比 Ramda/Rambda 更贴合当前 TypeScript 工作区。

建议把 **es-toolkit** 列为通用工具方向的次选预装候选。它的热度、生态和活跃度是本组最高，适合承接 `debounce`、`clone`、对象操作等不值得项目自行实现的通用能力；其角色应与 Remeda 区分，而不是让两套集合 API 在同一职责中任意混用。若主线程希望严格限制重叠依赖，可以只预装 Remeda；若更看重离线可用的通用实现，则两者可以同时预装并按职责使用。

不建议预装 Radash、Radashi、Ramda 或 Rambda。Radash 已超过一年没有发布和默认分支提交；Radashi 恢复了活跃维护但生态仍明显较小；Ramda 生态最成熟但 TypeScript 类型外置、抽象风格和打包注意事项更重；Rambda 改善了 TypeScript 适配，但强制 curry/pipe 的单一路径会更明显地锚定代码风格，且综合采用度低于 Remeda。

建议把 **Mnemonist** 列为专用数据结构的可预装候选，同时继续让原生 `Array`、`Map` 和 `Set` 承担普通集合。它的安装面约 413 KiB（含唯一生产依赖 `obliterator`）、模块可单独导入、类型内置，热度和维护状态均足以承担 Heap、Deque、Trie、LRU、Bloom Filter 等实现。预装的理由是避免真正需要这些结构时由 agent 临时实现或动态安装，不是鼓励在普通集合问题中使用它。

以上均为“建议预装”，不是“已经采用”或“已经验证”。若实际只允许增加一个本报告候选，优先选择 Remeda；若允许两个，选择 Remeda 与 es-toolkit；Mnemonist 是否加入第三个名额，取决于主线程是否把“专用结构离线可用”看得高于当前没有直接需求这一事实。

#### 函数式与通用工具对照

| 候选 | 轻量度 | 热度与生态 | 活跃度 | TypeScript、文档与风格影响 | 本轮判断 |
| --- | --- | --- | --- | --- | --- |
| [Remeda 2.39.0](https://registry.npmjs.org/remeda/latest) | 2.71 MiB、706 文件、0 生产依赖；`sideEffects: false`，支持 ESM/CJS 与 tree-shaking | [37,819,481 次/30 天](https://api.npmjs.org/downloads/point/2026-07-07:2026-08-05/remeda)，5,410 stars，约 825 npm dependents | 2026-06-09 发布；默认分支 2026-07-28 仍有提交 | 内置类型；[官方文档](https://remedajs.com/docs/)明确支持 data-first、data-last、`pipe`、惰性求值和 JSDoc | **首选**：连续数据转换与组合；简单操作仍可用原生方法 |
| [es-toolkit 1.50.0](https://registry.npmjs.org/es-toolkit/latest) | 3.70 MiB、3,958 文件、0 生产依赖；`sideEffects: false`；安装文件数较多，但按函数 tree-shake | [155,443,952 次/30 天](https://api.npmjs.org/downloads/point/2026-07-07:2026-08-05/es-toolkit)，11,279 stars，约 1,467 npm dependents | 2026-07-24 发布；默认分支 2026-08-07 有提交 | 内置类型；[官方文档](https://es-toolkit.dev/)完整，并列出 Storybook、Recharts、MUI、CKEditor 等采用者；性能与体积数字为上游宣称 | **次选/互补**：通用工具；不作为另一套管道范式 |
| [Radash 12.1.1](https://registry.npmjs.org/radash/latest) | 299 KiB、44 文件、0 生产依赖；本组安装面最小 | [7,421,424 次/30 天](https://api.npmjs.org/downloads/point/2026-07-07:2026-08-05/radash)，4,836 stars，约 539 npm dependents | 发布和默认分支最后提交均为 2025-06-18 | 内置类型，API 简单；维护已转向社区 fork Radashi | **不预装**：轻量优势不足以抵消停滞 |
| [Radashi 12.9.1](https://registry.npmjs.org/radashi/latest) | 448 KiB、7 文件、0 生产依赖；可 tree-shake | [596,740 次/30 天](https://api.npmjs.org/downloads/point/2026-07-07:2026-08-05/radashi)，945 stars，约 87 npm dependents | 2026-05-12 发布 | 内置类型、文档完整，是 Radash 的活跃 fork | **不预装**：方向健康，但采用度与既有候选有明显差距 |
| [Ramda 0.32.0](https://registry.npmjs.org/ramda/latest) | 1.15 MiB、744 文件、0 生产依赖；tree-shaking 效果依赖导入与 bundler 配置 | [60,526,801 次/30 天](https://api.npmjs.org/downloads/point/2026-07-07:2026-08-05/ramda)，24,061 stars，约 14,114 npm dependents | 2025-10-10 发布；默认分支 2026-07-26 有提交 | 生态与教材最成熟；包内无类型入口，需要外部类型包；自动 curry 与 data-last 会显著塑造全部调用 | **不预装**：作为 FP 基线有价值，但不是当前 TS 工作区的低摩擦选项 |
| [Rambda 11.2.0](https://registry.npmjs.org/rambda/latest) | 703 KiB、151 文件、0 生产依赖；`sideEffects: false` | [12,554,655 次/30 天](https://api.npmjs.org/downloads/point/2026-07-07:2026-08-05/rambda)，1,755 stars，约 242 npm dependents | 2026-05-15 发布并有默认分支提交 | 内置类型；官方定位为 TypeScript-focused，所有多参数方法以 curry 和 `pipe` 为主路径 | **不预装**：比 Ramda 轻，但风格锚定更强且与 Remeda 重叠 |

这里的“更容易表达函数式风格”只适用于数据转换本身就是主要结构的场景。把简单条件、一次性读写或有明确副作用顺序的过程改写成多层 pipe，并不会因为使用 Remeda/Rambda 自动获得更好的实现；那属于为了工具增加抽象。

#### 专用数据结构对照

| 候选 | 轻量度 | 热度与生态 | 活跃度 | 能力与边界 | 本轮判断 |
| --- | --- | --- | --- | --- | --- |
| [Mnemonist 0.40.4](https://registry.npmjs.org/mnemonist/latest) | 375 KiB、104 文件、1 个生产依赖；`obliterator` 另约 38 KiB且无依赖；模块可单独导入 | [57,374,076 次/30 天](https://api.npmjs.org/downloads/point/2026-07-07:2026-08-05/mnemonist)，2,432 stars，约 751 npm dependents | 2026-04-30 发布 | 类型内置；Heap、Deque、Trie、LRU、索引和概率结构覆盖广，API 接近原生集合；不含 Graph | **可预装**：作为专用结构的离线能力，普通集合仍用原生结构 |
| [@datastructures-js/priority-queue 6.4.0](https://registry.npmjs.org/%40datastructures-js%2Fpriority-queue/latest) | 自身约 15 KiB，连同 `@datastructures-js/heap` 约 35 KiB | [1,095,556 次/30 天](https://api.npmjs.org/downloads/point/2026-07-07:2026-08-05/%40datastructures-js%2Fpriority-queue)，682 stars，约 43 npm dependents | 2026-07-30 发布 | 类型内置，职责仅为基于 Heap 的优先队列 | **不作为通用预装**：若只需要优先队列很合适，但 Mnemonist 已覆盖且能避免再选包 |
| [js-sdsl 4.4.2](https://registry.npmjs.org/js-sdsl/latest) | 1.05 MiB、159 文件、0 生产依赖；可使用独立容器包 | [18,011,752 次/30 天](https://api.npmjs.org/downloads/point/2026-07-07:2026-08-05/js-sdsl)，800 stars，约 177 npm dependents | npm 最新发布为 2023-07-21；仓库 2026-04 仍有活动 | 类型内置，重点覆盖 STL 风格容器和性能基准 | **不预装**：下载量高，但发布新鲜度和覆盖面弱于 Mnemonist |
| [data-structure-typed 2.6.4](https://registry.npmjs.org/data-structure-typed/latest) | 10.54 MiB、393 文件、0 生产依赖；支持子路径导入 | [115,028 次/30 天](https://api.npmjs.org/downloads/point/2026-07-07:2026-08-05/data-structure-typed)，204 stars，npm dependents 当前值未可靠取得 | 2026-07-30 发布 | TypeScript 原生，结构覆盖最广且文档丰富 | **不预装**：活跃但安装体积和采用度未达到本轮门槛 |
| 原生 `Array` / `Map` / `Set` | 无依赖、无安装和网络开销 | JavaScript 标准生态 | 随运行时维护 | 足以承担当前仓库已观察到的集合、索引、去重与排序需求 | **普通问题默认**：明确需要专用复杂度或语义时再使用已预装的 Mnemonist |

Mnemonist 的高下载量可能包含大型下游的传递安装，不能单独证明本仓库需要它。支持预装的完整理由是“较小的依赖面 + 成熟采用 + 当前仍活跃 + 专用结构难以临时可靠实现 + 用户明确偏好提前取得依赖”；如果仓库最终选择只按已出现需求维护依赖，则继续使用原生结构同样是证据充分的结论。

#### 推荐顺序与复核条件

1. 优先预装 `remeda`，把它限定为连续数据转换与组合的可选实现工具。
2. 依赖名额允许时预装 `es-toolkit`，让通用工具有本地、稳定、无需临时搜索的实现；同一职责不要与 Remeda 任意混用同类集合函数。
3. 若接受为未来专用结构保留一个未必立即使用的依赖，预装 `mnemonist`；普通数组、映射和集合仍优先使用原生结构。
4. 不预装其余候选，也不让 agent 在实现途中自行安装替代库；已安装候选不能满足需求时，应先把缺口交回依赖 owner 决定。

采用后还需要由主线程验证锁文件变更、Bun/Node ESM 导入、仓库 typecheck，以及至少一个代表性 API 的类型推断。本报告应在候选出现持续维护停滞、重大版本改变模块/类型契约、项目工作负载转向浏览器 bundle，或实际代码开始需要本轮未覆盖的数据结构时重新调查。
