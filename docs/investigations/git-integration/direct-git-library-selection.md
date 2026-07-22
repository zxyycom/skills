# TypeScript Git 库选型调查

## 调查信息
- 核心问题: 本项目应选择哪种 TypeScript Git 库，候选的 API 适配、结果正确性、真实性能和社区可持续性能否共同支持采用？
- 状态: 调查中
- 最新报告时间: 2026-07-21T16:31:25+08:00

## 调查报告

### 统一选型需要正确性、性能与维护证据
- 形成时间: 2026-07-21T16:31:25+08:00

#### 形成时背景

本仓库主要由 Bun 执行 TypeScript 脚本，[调查时的 `package.json`](https://github.com/zxyycom/skills/blob/dcf9f5f1a43a1ca1b6635be8ded2d055b8c38938/package.json)要求 Bun `>=1.3`。当时 Git 读取集中在两类场景：[skill package hash](https://github.com/zxyycom/skills/blob/dcf9f5f1a43a1ca1b6635be8ded2d055b8c38938/scripts/lib/skill-package-hash.ts)读取 index 条目和 staged blob，[test-evidence Git 入口](https://github.com/zxyycom/skills/blob/dcf9f5f1a43a1ca1b6635be8ded2d055b8c38938/scripts/test-evidence/src/git.ts)恢复仓库、dirty paths 和提交间路径差异，[相关测试](https://github.com/zxyycom/skills/blob/dcf9f5f1a43a1ca1b6635be8ded2d055b8c38938/scripts/test-evidence/tests/run.ts)还覆盖 bare repository 与 linked worktree。

用户明确，“TypeScript 直接操作 Git”指项目代码通过带类型的库 API 表达操作，不要求库内部禁止 Git CLI 子进程。因此 Git CLI wrapper、纯 JavaScript 实现和原生绑定都可以比较；项目仍需保留仓库范围、路径、排序、冲突策略、字节内容和错误语义等业务校验。

#### 调查目的

本轮要建立统一的 Git 库选型口径：先判断 TypeScript API 能否覆盖项目调用并保持结果正确，再比较项目真实性能和社区可持续性。产出只用于确定候选与验证顺序；没有项目实测时不选择依赖，也不实施迁移。

#### 调查范围与依据

项目需求基于 `main@dcf9f5f1a43a1ca1b6635be8ded2d055b8c38938` 中的 Git 调用实现和测试，当时未提交变化不影响相关实现。候选资料按 2026-07-21 的官方 API、发布页面、GitHub 仓库和 npm 页面观察，范围包括 `simple-git`、`isomorphic-git`、`es-git`、`@napi-rs/simple-git` 和 `nodegit`。

本轮没有安装候选库、编写 adapter、运行结果等价实验或性能基准。社区数据只形成当日采用规模和近期活动的页面快照，没有保存原始响应，也没有完成贡献者、响应时间和安全修复的时间序列分析。

#### 调查结果与边界

`simple-git`、`isomorphic-git` 和 `es-git` 应进入主比较组：三者分别代表成熟 Git CLI wrapper、纯 JavaScript 实现和结构化 Node-API 绑定。`@napi-rs/simple-git` 只有在 index 与 diff 接口足以覆盖项目用例时加入，`nodegit` 只作历史参照。底层是否创建子进程不是淘汰条件，关键是 TypeScript 调用、结果语义、平台兼容和维护成本的整体取舍。

当前证据只能支持候选分组，不能支持最终采用。所有主候选都尚未用本仓库的 index/blob、status、diff 和 linked worktree 样本证明结果等价；没有同口径性能实测，社区页面也不足以形成完整健康判断。正确性准入、项目性能和长期维护风险应按顺序形成一条证据链，后一层不能掩盖前一层缺口。

#### 候选判断

| 候选 | 当前证据 | 当前判断 |
| --- | --- | --- |
| [`simple-git`](https://github.com/steveukx/git-js) | 提供 TypeScript API 和常见结构化结果，底层使用系统 Git，采用规模最大；高级操作仍可能退回 raw string、Buffer 或 `raw()` | 主候选和成熟度基线；需确认 index/blob 与 name-only diff 是否仍要求项目解析协议 |
| [`isomorphic-git`](https://github.com/isomorphic-git/isomorphic-git) | 纯 JavaScript 实现，可访问 repository、stage、object 和结构化状态，采用规模较大 | 主候选；需验证 linked worktree、attributes/filter 和 canonical Git 的边缘兼容 |
| [`es-git`](https://github.com/toss/es-git) | Node-API 绑定直接暴露 index、object、status 和 diff，`v0.7.0` 已声明 worktree 支持 | 主候选；API 历史、Bun/平台二进制、linked worktree 语义和维护集中度仍需验证 |
| [`@napi-rs/simple-git`](https://github.com/Brooooooklyn/simple-git) | Node-API 绑定提供 repository、config、index、tree、blob 和 status 等对象，近期仍有发布 | 条件候选；当前公开接口对 index 枚举和 tree-to-tree diff 的覆盖不够明确 |
| [`nodegit`](https://github.com/nodegit/nodegit) | libgit2 绑定能力和历史影响力较强，但最新稳定版本停在 2020 年 | 只作历史参照，不进入当前 Bun 项目的主验证 |

#### 验证顺序

1. **能力与正确性准入**：用同一组 TypeScript 样例验证仓库发现与 `HEAD`、config、index entry 与 staged blob、status、commit diff、普通 checkout 和 linked worktree；同时记录是否退回 raw 命令、adapter 代码量和错误语义。路径、mode、stage、OID、blob 字节、最终 hash 和路径集合必须与现有实现一致。
2. **项目性能比较**：只测量通过准入的候选，并使用相同 Bun、OS、仓库样本和结果投影；区分首次加载与同进程复用，至少记录耗时、CPU 和峰值 RSS。当前真实仓库用于判断实际收益，固定生成的不同规模仓库用于观察扩展趋势。
3. **长期维护风险**：对最终候选补充最近 6 至 12 个月的非机器人贡献者、发布间隔、issue/PR 响应、Bun/Windows 问题和安全修复记录，并结合 adapter 复杂度、二进制覆盖和 Git 兼容边界判断。

至少一个候选通过正确性准入，并且性能与维护证据足以解释“采用候选”或“保留现有 CLI adapter”的取舍后，本调查才具备结束条件。长期选择交给决策 owner，实际迁移进入实施流程。
