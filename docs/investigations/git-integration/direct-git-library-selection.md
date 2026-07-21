# TypeScript Git 库选型调查

## 调查信息
- 核心问题: 本项目应选择哪种 TypeScript Git 库，候选的 API 适配、结果正确性、真实性能和社区可持续性能否共同支持采用？
- 状态: 调查中
- 最新报告时间: 2026-07-21T16:31:25+08:00

## 调查报告

### 当前 Git 调用与候选库的适配性
- 形成时间: 2026-07-21T16:11:32+08:00

#### 背景

本仓库集中维护多个可独立分发的 skill，主要脚本由 Bun 执行，`package.json` 要求 Bun `>=1.3`。与本次调查直接相关的 TypeScript 实现通过 `node:child_process` 调用 Git CLI：skill package hash 需要读取 index 条目和 staged blob，test-evidence 需要恢复仓库、状态和提交间路径差异，测试还会建立 linked worktree。项目因此不仅依赖 Git 命令能执行，还依赖 `ls-files -z`、`cat-file --batch`、porcelain status 和 name-only diff 等输出语义。

仓库证据取自 `main@dcf9f5f1a43a1ca1b6635be8ded2d055b8c38938`。本报告引用的 `package.json` 和 Git 操作脚本与该提交一致；当时工作区的其他未提交变化集中在项目文档和 investigation-report 维护内容，不改变被调查的 Git 调用。候选资料按 2026-07-21 的公开文档与发布状态观察，尚未安装候选库，也未运行兼容性或性能实验。

#### 起因

用户发现项目存在多处直接 Git 操作，希望调查能够由 TypeScript 直接调用的 Git 库，减少业务代码自行创建进程、提取输出和维护格式校验。本轮形成时把这个目标理解为“候选库本身也不能创建 Git CLI 子进程”，因此先按纯 JavaScript 或原生绑定路线筛选候选。

#### 调查结果

在“不创建 Git CLI 子进程”这一当时的筛选条件下，公开 API 显示 `es-git@0.7.0` 对 index、object、status、diff 和 worktree 的覆盖最接近项目调用面，最值得先做小范围兼容性验证。`isomorphic-git` 可作为纯 JavaScript 备选，`@napi-rs/simple-git` 的 index 枚举与 tree-to-tree diff 接口仍有缺口，`simple-git` 因内部继续调用 Git CLI 被排除，`nodegit` 因维护与现代运行时风险不进入验证。

这些结果只支持当时条件下的候选排序，不能证明 `es-git` 能无差异替换现有实现。Bun 加载原生扩展、linked worktree、暂存但未提交的 blob、status 分类和 diff 路径语义仍未经过项目样本验证，也没有形成依赖选择或迁移决定。

#### 本仓库实际需要什么

本轮读取了项目脚本、测试和配置入口，以实际调用而非一般 Git 功能列表作为比较口径：

1. [`package.json`](../../../package.json) 要求 Bun `>=1.3`，项目脚本也主要由 Bun 执行；候选库必须能在 Bun、Windows 开发环境和 CI 目标上工作。
2. [`scripts/lib/skill-package-hash.ts`](../../../scripts/lib/skill-package-hash.ts) 通过 `rev-parse --show-toplevel` 定位仓库，通过 `ls-files -s -z` 读取索引条目，再通过 `cat-file --batch` 读取索引 OID 指向的 blob。代码自行解析行格式、NUL 分隔和 batch 帧，并依赖暂存区内容而不是只读取 `HEAD` 或工作区。
3. [`scripts/test-evidence/src/git.ts`](../../../scripts/test-evidence/src/git.ts) 调用 `rev-parse`、`ls-files`、`status --porcelain=v1 -z` 和 `diff --name-only -z`，再自行恢复仓库信息、文件集合、脏路径和两个提交之间的路径差异。
4. [`scripts/test-evidence/tests/run.ts`](../../../scripts/test-evidence/tests/run.ts) 会创建 bare repository，并通过 `git worktree add` 建立 linked worktree。候选库只支持普通 checkout 还不够，必须在 `.git` 为文件、引用与索引可能位于 worktree 专属目录的场景中通过现有行为测试。
5. [`scripts/setup-git-hooks.ts`](../../../scripts/setup-git-hooks.ts)、[`.githooks/pre-commit`](../../../.githooks/pre-commit) 和 [打包 workflow](../../../.github/workflows/package-skills.yml) 也调用 Git，但这些调用位于一次性配置、shell hook 或 CI 命令边界，当前没有让 TypeScript 解析复杂输出。它们不是第一阶段迁移对象。

由此得到的核心比较条件是：不创建 Git CLI 子进程；能结构化读取 index 条目及其 blob；能恢复 status 和 tree diff；能处理 linked worktree；能由 Bun 加载并覆盖项目目标平台；同时不能用删除项目级校验来掩盖库与现有语义的差异。

#### 候选库证据与判断

以下外部资料均在 2026-07-21 访问，版本和维护状态属于当时观测，后续采用时需要重新确认。

| 候选 | 直接证据 | 与当前需求的关系 | 当前判断 |
| --- | --- | --- | --- |
| [`es-git`](https://es-git.dev/getting-started.html) | 官方说明其通过 Rust `git2`/libgit2 和 Node-API 提供 TypeScript 接口，安装示例包含 `bun add es-git`；公开 API 包含 `Index.entries()`、对象读取、`Repository.statuses()` 和 [`diffTreeToTree()`](https://es-git.dev/reference/Repository/Methods/diffTreeToTree.html)。[`v0.7.0` 发布说明](https://github.com/toss/es-git/releases/tag/v0.7.0)明确增加了带测试的 worktree 功能。 | 能直接覆盖 index、object、status 和 diff 四个主要调用面，也有与现有 linked worktree 测试对齐的功能声明。 | 优先验证；尚不能直接采用，因为 0.x API、原生二进制和具体 Git 语义仍需项目样本证明。 |
| [`isomorphic-git`](https://github.com/isomorphic-git/isomorphic-git) | 纯 JavaScript 实现，不需要原生扩展或 Git 子进程；[`walk`](https://isomorphic-git.org/docs/en/walk) 可访问 TREE、WORKDIR 和 STAGE，[`statusMatrix`](https://isomorphic-git.org/docs/en/statusMatrix.html) 提供结构化状态。 | 运行时依赖最简单，但公开 [`findRoot`](https://isomorphic-git.org/docs/en/findRoot) 语义是寻找包含 `.git` 子目录的目录，不能据此确认 linked worktree 的发现和引用路由；与原生 Git 的完整兼容边界也更大。 | 若项目明确拒绝原生依赖，可作为第二方向；在 linked worktree 需求未证明前不优先。 |
| [`@napi-rs/simple-git`](https://github.com/Brooooooklyn/simple-git) | 名称虽与 `simple-git` 相近，但它是 Rust/Node-API 绑定而不是 CLI wrapper，并公开 repository、config、index、tree、blob、status 等结构化对象。 | 能覆盖部分直接操作，但本轮检查其公开接口时，没有找到与 `Index.entries()` 和结构化 tree-to-tree diff 同样直接的组合；为当前 index blob 与 diff 用例可能需要更多绕行。 | 保留为原生绑定备选，不作为第一验证对象。 |
| [`simple-git`](https://github.com/steveukx/git-js) | 官方定位是运行 Git 命令的轻量接口，要求系统已安装 Git，并通过子进程执行命令；部分返回值仍是原始字符串、Buffer 或库自行解析的结果。 | 可以减少调用样板，但没有消除子进程和输出格式依赖，未解决本次核心问题。 | 排除。 |
| [`nodegit`](https://github.com/nodegit/nodegit) | 提供 libgit2 的 Node.js 原生绑定，但官方仓库展示的稳定版本和 libgit2 基线明显早于当前 Bun/Node-API 生态。 | 理论能力较完整，但维护活跃度、现代运行时与分发兼容风险高于其他候选。 | 不进入当前验证。 |

[`Bun Node-API 文档`](https://bun.sh/docs/runtime/node-api)说明 Bun 已实现大部分 Node-API，且多数现有扩展可以工作；这只能支持“值得验证”，不能证明 `es-git` 在本项目平台组合上已经兼容。原生绑定还会引入预编译二进制覆盖、加载失败和 libgit2 与 Git CLI 边界差异，这些风险不能由 API 列表消除。

#### `es-git` 的预期替换边界

如果兼容性实验通过，现有命令可以按下表进入一个仓库内 adapter，而不是让业务代码直接依赖第三方类型：

| 现有调用 | 候选结构化入口 | 仍由项目负责的判断 |
| --- | --- | --- |
| `rev-parse --show-toplevel`、`HEAD` | repository discovery、`workdir()`、`revparseSingle()` | 目标是否位于预期仓库、bare/worktree 是否允许、错误信息怎样暴露 |
| `ls-files -s -z` | `index().entries()` | 只接受哪些 stage、冲突怎样处理、路径怎样归一化和排序 |
| `cat-file --batch` | 根据 index entry OID 读取 object/blob content | 对象类型必须是 blob、缺失对象怎样失败、字节必须保持原样 |
| `status --porcelain` 与 `ls-files` | `statuses()`、index entries | 什么算 dirty、是否包含 ignored/untracked/deleted、路径去重规则 |
| `diff --name-only --no-renames` | commit tree 与 `diffTreeToTree()` 的 deltas | rename 关闭后的等价行为、old/new path 选择、输出确定性 |

结构化 API 可以删除 Git 文本协议的解析和格式校验，例如 porcelain 条目切分、`cat-file --batch` 帧长度处理和 OID 行正则；它不能删除业务契约校验。仓库根目录限制、stage 0 或冲突策略、路径越界检查、确定性排序、重复项处理以及面向调用方的错误语义仍应由 adapter 或现有 owner 承接。

#### 当前推断及其边界

1. **优先迁移 TypeScript 内的读取型调用**：这部分直接承担输出解析，也是直接库收益最大的地方。hook 和 workflow 已经处于命令行执行边界，强行替换会扩大改动而不减少现有解析负担。
2. **先建立窄 adapter 再迁移业务代码**：候选仍为 0.x，隔离 repository、index、blob、status 和 diff 的最小返回类型，可以限制 API 变化与实现差异的传播。这是基于风险的建议，不是已形成的架构决定。
3. **现有 CLI 实现应暂时作为对照基线**：在新实现证明等价前删除旧实现，会失去判断 staged blob、worktree 和路径边界是否回归的依据。
4. **“没有子进程”不等于“没有校验”**：库只负责解释 Git 仓库结构，项目仍需证明输出满足 skill hash 和测试证据的本地契约。

#### 仍然未知

1. `es-git@0.7.0` 的预编译扩展能否同时被 Windows/Bun 开发环境和当前 CI 环境稳定加载。
2. 其 worktree 支持是否覆盖本仓库测试创建的 linked worktree，而不仅是创建、枚举或删除 worktree 的 API。
3. 从 index entry 读取的 blob 字节是否与 `git cat-file --batch` 对暂存但未提交内容的结果完全一致，冲突 stage 和缺失对象怎样表现。
4. `statuses()` 对 tracked、untracked、deleted、重命名、特殊字符路径和 ignore 规则的分类，是否能无损投影为现有 `dirtyPaths`。
5. `diffTreeToTree()` 的 delta 是否能稳定复现 `git diff --name-only --no-renames -z` 的路径集合和排序要求。
6. sparse checkout、attributes/filter、LFS、不同对象格式等本轮未覆盖的 Git 特性是否属于项目实际兼容契约；目前不能因为未观察到就认定无影响。

#### 下一轮最有区分力的调查

下一轮应做一次不替换生产实现的兼容性对照实验：固定 `es-git@0.7.0`，在仓库 adapter 原型中分别读取普通 checkout 和现有测试生成的 linked worktree，并与当前 Git CLI 实现比较以下结果：仓库根目录与 `HEAD`、index 路径/模式/stage/OID、每个 staged blob 的原始字节及最终 skill hash、tracked/untracked/deleted/冲突路径集合，以及两个提交间关闭 rename 后的差异路径。实验至少覆盖 Windows+Bun 和 CI 的 Bun 环境，并记录原生扩展加载结果。

只有这些样本在字节、路径集合和失败语义上达到项目要求后，才有证据把 `es-git` 从“优先候选”提升为采用方向；若 linked worktree 或 Bun 原生加载失败，再比较 `isomorphic-git` 的定向适配成本、`@napi-rs/simple-git` 的缺失接口绕行，或保留现有 Git CLI adapter。长期采用和实际迁移分别进入决策与实施 owner，本报告不替代它们。

### TypeScript 调用目标与统一选型证据链
- 形成时间: 2026-07-21T16:31:25+08:00

#### 背景

本仓库集中维护多个可独立分发的 skill，主要脚本由 Bun 执行，[`package.json`](../../../package.json) 要求 Bun `>=1.3`。当前 TypeScript Git 调用集中在两类读取场景：[skill package hash](../../../scripts/lib/skill-package-hash.ts) 通过 index 条目和 staged blob 计算确定性结果；[test-evidence Git 入口](../../../scripts/test-evidence/src/git.ts)恢复仓库、文件集合、dirty paths 和提交间路径差异，[相关测试](../../../scripts/test-evidence/tests/run.ts)还覆盖 bare repository 与 linked worktree。[hook 配置](../../../scripts/setup-git-hooks.ts)和[打包 workflow](../../../.github/workflows/package-skills.yml)也调用 Git，但没有在 TypeScript 业务代码中承担复杂输出解析，因此不属于第一阶段重点。

用户已经明确，“TypeScript 直接操作 Git”指项目代码能够通过带类型的库 API 表达 Git 操作，不要求库内部绝对禁止子进程。Git CLI wrapper、纯 JavaScript 实现和原生绑定都可以比较；项目仍需保留仓库范围、路径、排序、冲突策略、字节内容和错误语义等业务校验，不能把“使用库”误写成“删除校验”。

仓库证据取自 `main@dcf9f5f1a43a1ca1b6635be8ded2d055b8c38938`，本报告引用的 `package.json` 与 Git 操作脚本和该提交一致；当时未提交变化不影响这些实现。候选资料和社区数据按 2026-07-21 的公开页面观察，范围包括 `simple-git`、`isomorphic-git`、`es-git`、`@napi-rs/simple-git` 和作为历史参照的 `nodegit`。本轮没有安装候选库、编写 adapter 原型或执行项目性能基准。

#### 起因

用户进一步校正了调查目标：核心是 TypeScript 能否直接调用，而不是候选库内部能否使用子进程；同时要求把 TypeScript 库能力、性能探查和社区热度放在同一份调查报告中。此前按“无子进程”筛选候选的排序因此需要修订，并需要明确三类证据如何共同支持同一个选型问题。

#### 调查结果

本轮确认，API 适配与结果正确性、项目真实性能、社区可持续性不是三个独立选题，而是同一次 Git 库选型的连续证据层，应由一个主题文件统一承接。`simple-git` 因提供 TypeScript API 而重新进入主候选，并作为成熟 Git CLI wrapper 和采用规模基线；`isomorphic-git` 代表纯 JavaScript 路线，`es-git` 代表结构化 API 较完整的 Node-API 路线，`@napi-rs/simple-git` 在关键接口足够时进入比较，`nodegit` 只作历史参照。

当前证据可以支持候选分组和验证顺序，但不能支持最终采用：所有主候选都还没有用本仓库的 index/blob、status、diff 和 linked worktree 样本证明结果等价；没有同口径跨库实测，因此不能判断真实性能排序；社区数据只形成采用规模与近期活动快照，尚不能给出完整社区健康结论。当前口径是先做 TypeScript API 与结果等价验证，只让通过者进入项目性能基准，再结合社区维护风险、平台兼容和 adapter 复杂度形成取舍。

#### 选型目标与证据顺序

本报告当前所说的“TypeScript 直接调用”包含以下要求：

1. 项目代码能够导入稳定、带类型的库接口，以方法和结构化参数表达常见 Git 操作，而不是在每个调用点拼接命令行与处理进程生命周期。
2. 常见结果优先返回具有明确字段语义的对象；如果关键用例仍只能调用 raw command 并自行解析输出，该库只解决了进程封装，没有完全解决当前维护负担，需要在能力矩阵中单独标记。
3. 错误、取消、并发、工作目录和 Git 版本差异能够在统一 adapter 中处理，不让业务代码重复恢复这些边界。
4. 库内部是否创建子进程不再是硬性淘汰条件，而是性能、兼容性、部署、安全和可观测性比较项。

这一定义取代早期按“是否创建子进程”直接筛选候选的口径；index/blob、linked worktree 和业务校验边界仍是有效的正确性条件，但候选排序改由 TypeScript API 覆盖、实际性能和社区持续性共同决定。

统一选型按以下证据层推进；前一层不成立时，不用后一层的优势掩盖缺口：

| 证据层 | 回答的问题 | 对选型的作用 |
| --- | --- | --- |
| API 适配与结果正确性 | TypeScript 调用是否自然，现有 index/blob、status、diff、config 与 worktree 语义是否保持一致？ | 形成可进入比较的候选集，是后续测量的前提。 |
| 项目真实性能 | 候选在相同 Bun、仓库样本和结果投影下，冷启动与稳态成本分别是多少？ | 量化可采用候选之间的运行成本，不替代正确性。 |
| 社区可持续性 | 发布、维护者、下游采用、平台覆盖和修复响应能否支持长期依赖？ | 约束长期维护风险，并在能力与性能接近时参与取舍。 |

#### 候选库的 API 适配与结果正确性

第一层证据先判断库能否自然表达本项目需要的操作，不预设哪种底层实现更好：

| 路线与代表库 | 对 TypeScript 目标的价值 | 当前重点缺口 |
| --- | --- | --- |
| Git CLI wrapper：[`simple-git`](https://github.com/steveukx/git-js) | 自带 TypeScript 声明，覆盖大量 Git 命令，并为 status、log、branch、config 等常见操作提供结构化结果；底层继续使用系统 Git，有利于保留 Git CLI 的兼容语义。 | 官方说明仍有 API 返回 raw string/Buffer，未提供专门 wrapper 时使用 `raw()`；需要逐项确认 index entry、batch blob 和 name-only diff 是否仍要求项目解析。 |
| 纯 JavaScript：[`isomorphic-git`](https://github.com/isomorphic-git/isomorphic-git) | 不依赖系统 Git 或原生扩展，提供函数式 JavaScript/TypeScript API，并能直接读写 repository、stage 和 object。 | linked worktree、Git 属性/filter、对象格式和与 canonical Git 的边缘兼容仍需项目样本验证；浏览器能力不是本仓库的直接收益。 |
| Node-API 原生绑定：[`es-git`](https://github.com/toss/es-git)、[`@napi-rs/simple-git`](https://github.com/Brooooooklyn/simple-git) | 直接暴露 repository、index、object、status 和 diff 对象，较有机会同时获得结构化 API 与较低调用开销。 | 两者社区和 API 历史较短；需要确认 Bun/平台二进制、linked worktree 语义以及当前关键操作是否都有直接接口。 |
| 传统原生绑定：[`nodegit`](https://github.com/nodegit/nodegit) | 历史 API 较完整，能说明 libgit2 绑定路线曾被广泛采用。 | 最新稳定发布停在 2020 年，不适合作为当前 Bun 项目的主验证对象。 |

能力选型不应只统计方法名。下一轮需要为每个主候选实现同一组最小样例，并记录返回类型、是否退回 raw 命令、需要补多少 adapter 代码、错误是否可区分，以及以下操作是否成立：仓库发现与 `HEAD`、config 读写、index entry 与 staged blob、clean/dirty/untracked/deleted/conflict 状态、commit-to-commit 路径差异、普通 checkout 和 linked worktree。只有能够保持当前结果语义的候选才进入性能比较。

基于现有 API 和社区证据，主比较组暂定为 `simple-git`、`isomorphic-git` 与 `es-git`；`@napi-rs/simple-git` 在其 index 与 diff 接口足以覆盖当前用例时加入，`nodegit` 只保留历史参照。这个分组是调查优先级，不是采用排序。

#### 当前性能证据与项目基准设计

本轮没有发现能够直接回答本仓库问题的官方跨库基准。`es-git` 仓库包含 benchmark 材料并以性能为产品目标，但不同库的公开结果在运行时、仓库规模、冷热缓存、操作语义和版本上没有共同口径；“CLI wrapper 必然慢”“原生绑定必然快”或“纯 JavaScript 没有进程启动所以更快”目前都只是候选机制，不能当作本项目结论。

性能探查应在能力和结果等价之后进行，至少包含以下工作负载：

| 工作负载 | 本项目对应入口 | 必须先证明的结果等价 | 主要性能指标 |
| --- | --- | --- | --- |
| 仓库发现、读取 `HEAD` 与 config | test-evidence 初始化、hook 配置 | worktree 根目录、commit OID 和 config scope 一致 | 冷启动耗时、稳态耗时、失败开销 |
| 枚举 index 并读取 staged blobs | skill package hash | 路径、mode、stage、OID、原始 blob 字节和最终 hash 一致 | 总耗时、每千文件耗时、CPU、峰值 RSS |
| clean 与 dirty status | test-evidence Git Scope | tracked、untracked、deleted、conflict 与特殊字符路径集合一致 | 冷/热缓存耗时、文件数扩展曲线、内存 |
| 两个 commit 的路径差异 | test-evidence Git Scope | 关闭 rename 后的路径集合和排序规则一致 | 小 diff、大 diff 的耗时与分配 |
| linked worktree 重复上述读取 | 现有 test-evidence fixture | `HEAD`、index、refs 和 workdir 都指向正确 worktree | 相对普通 checkout 的额外开销与失败率 |

样本至少分两层：当前真实仓库用于判断实际收益；固定生成的 1k/10k 文件仓库用于观察扩展趋势。每个候选使用相同 Bun 版本、OS、仓库副本和结果投影，分开记录首次模块加载与同进程复用；只有能够控制并记录文件系统缓存条件时才标记冷、热缓存，否则使用新仓库副本与随机交错顺序降低顺序偏差，并明确缓存不可控。重复次数应在执行前固定，报告给出中位数、p95、离散程度、CPU 和峰值 RSS。子进程数量、原生模块加载时间和 Git/libgit2 版本作为解释变量记录，而不是先验评分。

真实性能结论还需要先定义“有意义的差异”。当前尚无证据说明这些 Git 操作占 CI 或本地检查的多少比例，也没有可接受回归阈值；在测量现有实现的基线之前，不应为了理论上的进程启动成本承担明显更高的 API、平台或社区风险。

#### 社区可持续性证据快照

以下数据在 2026-07-21 观测。GitHub star、fork 和累计 commit 来自各项目公开仓库，npm 下载与 dependents 来自 npm 包页面；本轮只保留了访问日期和页面来源，没有保存逐项采集时刻或原始响应，因此这些数值是可定位但不可复现的当日 UI 快照。UI 数值可能取整，周下载会滚动变化，下载量包含自动化和间接使用，原生库拆分平台包后尤其不能把单一包下载量直接解释为独立用户数。

| 候选 | 观测证据 | 当前解释 |
| --- | --- | --- |
| [`simple-git`](https://github.com/steveukx/git-js) | 约 3.9k stars、339 forks、1,549 commits；[`simple-git@3.36.0`](https://www.npmjs.com/package/simple-git)约 968 万周下载、8,376 dependents，最近发布约三个月。 | 当前最强的 Node/TypeScript Git wrapper 采用信号，适合作为 API 成熟度、Git 兼容性和性能基线；高采用量不保证每个高级操作都有结构化结果。 |
| [`isomorphic-git`](https://github.com/isomorphic-git/isomorphic-git) | 约 8.3k stars、481 forks、1,192 commits；GitHub 显示 `v1.38.9` 于 2026-07-19 发布；[npm](https://www.npmjs.com/package/isomorphic-git)约 147 万周下载、597 dependents，抓取版本与 GitHub 最新发布存在短暂时差。 | 累计关注和采用规模都较强、发布频繁；但项目 README 说明原作者已经离开，目前主要由两名志愿者维护和评审，功能投入能力需要与发布频率分开判断。 |
| [`es-git`](https://github.com/toss/es-git) | 326 stars、16 forks、222 commits、17 个 GitHub releases；`v0.7.0` 于 2026-05-17 发布。本轮没有取得可与其他包同口径的 npm 下载数，平台二进制拆包也会影响解释。 | 由 Toss 组织维护、近期仍在增加 worktree 等能力，但属于规模较小、历史较短的新库；不能用组织背书替代 bus factor、Bun 和 API 稳定性验证。 |
| [`@napi-rs/simple-git`](https://github.com/Brooooooklyn/simple-git) | 190 stars、2 forks、195 commits、24 个 releases；`v1.1.0` 于 2026-07-07 发布；[npm](https://www.npmjs.com/package/@napi-rs/simple-git)约 30 万周下载、23 dependents。 | 近期发布活跃且已有一定下载量，但公开协作者与下游规模仍明显小于两个成熟 JavaScript 方案，需要重点判断维护集中度和 API 覆盖。 |
| [`nodegit`](https://github.com/nodegit/nodegit) | 约 5.8k stars、698 forks、4,053 commits；最新稳定 release `v0.27.0` 发布于 2020-07-28。 | 体现历史影响力，不体现当前可持续性；它说明 star 和累计 commit 不能脱离最近发布、当前 runtime 与维护响应单独使用。 |

这组快照支持的结论有限但清楚：`simple-git` 和 `isomorphic-git` 的真实采用面显著大于两个新原生绑定；`es-git` 与 `@napi-rs/simple-git` 有近期活动，却需要承担 API 历史较短和维护集中度较高的风险；`nodegit` 的高累计热度无法抵消长期没有稳定发布。社区热度不能直接决定技术选型，但当能力与性能接近时，应优先降低维护中断、平台包缺失和安全修复延迟的风险。

后续社区探索不只重复抓 star 数，应在进入最终候选后补充最近 6 至 12 个月的非机器人提交者、release 间隔、issue/PR 首次响应和关闭时间、关键维护者集中度、Bun/Windows 相关问题处理记录，以及安全公告到修复版本的时间。当前快照没有完成这些时间序列，因此只能用于候选分层，不能给出完整“社区健康分”。

#### 统一选型规则与下一步

接续调查按以下顺序推进，每一层都保留输入版本、仓库样本、结果投影和失败原因：

1. **能力与正确性准入**：用同一组 TypeScript 用例验证仓库发现、config、index/blob、status、commit diff 和 linked worktree。候选必须保持现有字节、路径集合和失败语义，并把 raw 命令与协议解析限制在可接受的 adapter 边界内，才能进入性能测量。
2. **项目性能比较**：只对通过准入的候选固定版本并执行同口径基准，同时测量现有 CLI 实现所占的本地检查和 CI 时间。先定义可接受回归与有意义收益，再判断性能差异是否值得承担额外平台或维护风险。
3. **长期依赖风险复核**：对进入最终比较的候选补齐最近 6 至 12 个月的贡献者、release、issue/PR 响应、Bun/Windows 问题和安全修复记录，并与 adapter 复杂度、二进制覆盖和 Git 兼容边界一起判断。
4. **形成调查出口**：至少一个候选通过正确性准入，且性能与维护证据足以解释采用或保留现有 CLI adapter 的取舍后，结束本调查并把长期选择交给决策 owner；实际迁移另行进入实施流程。

内部仍使用 Git CLI 的 `simple-git` 可以满足“由 TypeScript 直接操作”的核心目标；原生库即使更快，也不能用性能优势抵消关键 API 绕行、Bun 二进制不稳定或维护风险。
