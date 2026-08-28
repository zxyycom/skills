---
title: "采用 neverthrow 并由项目源码承接 Option"
formedAt: "2026-08-07T11:44:13+08:00"
question: "本项目应预装哪个轻量 Result 库，并怎样与项目自有 Option 形成稳定边界？"
tags:
  - "implementation-libraries"
relations: []
---

## 形成时背景

本仓库正在扩展 [`docs/coding-style.md`](../coding-style.md)，以“问题形态、优先实现模型、主要价值”给 AI 提供稳定的实现方向。用户希望常用抽象在项目内预先可用，避免实现过程中临时搜索和安装依赖；其中已经明确授权把 `neverthrow` 加入项目依赖，并把其旧项目 [`line-rotating`](https://cnb.cool/158com_code/line-rotating) 中的 `assets/libs/option.ts` 直接复制到本项目。其他库只有经调查确认值得作为项目默认能力时才安装，不因出现在规范中而成为动态下载提示。

调查开始时本仓库为 `c8506725342ca22501995620b4f34b6053dc3397`。工作区已有 `.codex/config.toml` 与 `docs/coding-style.md` 的未提交改动；这些改动解释了本轮调查的触发背景，但没有改变候选包元数据。根 `package.json` 定义了 private pnpm 项目，源码由 Bun 运行、构建和测试，当时没有 Result/Option 类依赖，代码中的 `Option` 名称只来自 Commander CLI。

`line-rotating` 的检查快照为 `3b00a58b06908c58c4bd81161c77d860fbc4f7fc`。该项目声明 `neverthrow@^8.2.0`，其 `Option` 源码共 228 行、5,807 bytes，提供 `Some`、单例 `None`、`map`、`andThen`、`match`、`filter`、`unwrapOr`、`fromNullable` 以及到 `neverthrow.Result` 的转换。

## 调查目的

本轮比较 `neverthrow`、`true-myth`、`oxide.ts`、`purify-ts`，并以较宽的 `fp-ts` 作为基线，回答以下问题：

1. 哪个候选能以较小安装和概念成本提供成熟的显式失败表达。
2. 候选的采用热度、TypeScript 生态和近期维护是否足以支持预装。
3. 已授权的 `neverthrow` 与项目自有 `Option` 是否互补，复制源码需要哪些最小适配和验证。
4. 哪些候选应当进入项目，哪些只应保留为本次选型证据。

本轮只形成依赖与源码归属建议，不安装包、不复制源码、不修改编码规范，也不替后续实现验证宣称已经采用。

## 调查范围与依据

外部快照时间为 2026-08-07。包版本、生产依赖、文件数、unpacked size、license、Node engine 和最近 12 个月发布数来自 [npm registry](https://registry.npmjs.org/) 的 latest 版本元数据；采用热度统一使用 [npm downloads API](https://github.com/npm/registry/blob/main/docs/download-counts.md) 对 2026-07-08 至 2026-08-06 这 30 个完整 UTC 自然日的下载计数。unpacked size 表示 npm 安装内容，不等同于 tree-shaking 后的运行时代码。

GitHub stars、默认分支最近 commit 与归档状态来自 2026-08-07 观察到的各候选官方 GitHub 仓库和公开 API。API 数据是易变快照，报告没有保存原始响应；stars 与下载量只作为采用和生态信号，不代表正确性、安全性或项目适配已经得到证明。API 后续请求触及匿名 rate limit，没有继续扩展到贡献者时间序列、issue/PR 响应时间或安全修复时长。

API 形态、TypeScript 支持与配套材料依据各候选官方 README、文档和发布 manifest。项目内适配依据当前根 `package.json`、`tsconfig.json`、[`docs/tooling.md`](../tooling.md) 的源码与依赖边界，以及 `line-rotating@3b00a58b06908c58c4bd81161c77d860fbc4f7fc` 的 `package.json`、`assets/libs/option.ts` 和实际引用。没有安装候选、运行 Bun/TypeScript 兼容测试、测量最终 bundle、执行 npm audit 或完成供应链审计。

## 调查结果与边界

**建议只把 `neverthrow@8.2.0` 作为这一类别的第三方依赖，并复制项目自有 `Option` 源码；不要同时预装其他 Result/Option 库。** `neverthrow` 在轻量度、采用规模、TypeScript 专注度和异步失败支持之间最均衡，也符合用户已有使用经验。项目自有 `Option` 负责“值存在或缺失”，`neverthrow.Result` / `ResultAsync` 负责“成功或带原因失败”，两者通过 `toResult` 在需要错误语义的边界衔接。

| 候选 | 轻量度快照 | 热度快照 | 活跃度快照 | 生态、适配与判断 |
| --- | --- | --- | --- | --- |
| [`neverthrow@8.2.0`](https://registry.npmjs.org/neverthrow/8.2.0) | 约 110 KiB、6 files、0 常规生产依赖，Node `>=18`；manifest 另列 1 个 Linux Rollup 可选依赖 | [30 日 8,990,996 次](https://api.npmjs.org/downloads/point/2026-07-08:2026-08-06/neverthrow)；[7,661 stars](https://github.com/supermacro/neverthrow) | npm 发布于 2025-02-21；默认分支最近 commit 为 2026-02-14；未归档 | 原生 TypeScript `Result`、`ResultAsync`、组合与批量结果 API，文档完整并有独立 ESLint 插件。**第一名，作为唯一 Result 依赖采用**；发布节奏不快且 npm maintainer 快照为 1 人，升级前仍需复核 |
| [`true-myth@9.4.0`](https://registry.npmjs.org/true-myth/9.4.0) | 约 857 KiB、76 files、0 生产依赖；官方说明 ESM 可 tree-shake | [30 日 2,986,305 次](https://api.npmjs.org/downloads/point/2026-07-08:2026-08-06/true-myth)；[1,354 stars](https://github.com/true-myth/true-myth) | npm 发布于 2026-05-25；最近 commit 为 2026-06-27；近 12 个月 5 个版本 | 同时提供 `Maybe`、`Result`、`Task` 和包内 ESLint plugin，官方声明支持 TypeScript 5.3–6.0。**第二名和首要替代候选**，但与已选 Result 和本地 Option 双重重叠，且尚未声明支持项目使用的 TypeScript 7 preview，因此不预装 |
| [`purify-ts@2.1.4`](https://registry.npmjs.org/purify-ts/2.1.4) | 约 196 KiB、44 files；1 个生产依赖 `@types/json-schema`；声明 `sideEffects: false` | [30 日 504,554 次](https://api.npmjs.org/downloads/point/2026-07-08:2026-08-06/purify-ts)；[1,602 stars](https://github.com/gigobyte/purify) | npm 发布及最近 commit 均为 2025-12-16；近 12 个月 2 个版本 | 提供 `Maybe`、`Either`、异步类型、Codec 等更宽的实用 FP API。**第三名**；生态和近期发布可接受，但概念面超出本轮 Result/Option 基础，且与 Valibot、neverthrow、本地 Option 均有交叉，不预装 |
| [`oxide.ts@1.1.0`](https://registry.npmjs.org/oxide.ts/1.1.0) | 约 98 KiB、15 files、0 生产依赖 | [30 日 177,506 次](https://api.npmjs.org/downloads/point/2026-07-08:2026-08-06/oxide.ts)；[593 stars](https://github.com/traverse1984/oxide.ts) | npm 发布和默认分支最近 commit 均停在 2022-10-25；未归档 | Rust 风格 `Option`、`Result` 和 match API 紧凑，体积最小。**第四名**；长期无发布和默认分支提交，活跃度不满足当前预装基线，不采用 |
| [`fp-ts@2.16.11`](https://registry.npmjs.org/fp-ts/2.16.11) | 约 4.52 MiB、619 files、0 生产依赖；声明 `sideEffects: false` | [30 日 17,149,557 次](https://api.npmjs.org/downloads/point/2026-07-08:2026-08-06/fp-ts)；[11,532 stars](https://github.com/gcanti/fp-ts) | npm 发布于 2025-08-18；最近 commit 为 2026-04-20；近 12 个月 1 个版本 | 提供 Option、Either、Task、IO、type classes 与 HKT 的完整 typed-FP 体系，热度最高但文档假设使用者已有 FP 知识。作为宽基线说明“热度高不等于适合窄能力预装”，不进入本轮排序和依赖 |

以上排序是基于当前目标的建议，不是对库质量的通用排名。若项目未来决定采用统一的完整 FP 体系，`fp-ts` 或其他框架需要以新的问题重新调查；不能从本轮“不预装”外推为它们不值得使用。

**已确认事实：**

1. `neverthrow` 只提供 Result 语义，不提供 Option；与本地 Option 的核心职责没有重复。它的官方 README 明确提供同步 `Result` 和包装 `Promise<Result>` 的 `ResultAsync`，并推荐 [`eslint-plugin-neverthrow`](https://github.com/mdbetancourt/eslint-plugin-neverthrow) 检查未消费的 Result。其包 manifest 还把 `@rollup/rollup-linux-x64-gnu` 列为可选依赖；该项不属于 Result 运行时 API，但会进入跨平台锁文件并可能增加 Linux 安装开销。
2. 本地 Option 源码的唯一外部耦合是 `neverthrow` 的 `err`、`ok` 和 `Result`。原文件使用 `libs/npm/neverthrow/neverthrow.js` 这一 `line-rotating` 专用路径，复制后必须改为本项目依赖入口；其余实现不需要运行时依赖。
3. 原 Option 明确区分 `some(value)` 与 `fromNullable(value)`，并以单例 `none` 表达缺失；`toResult(err_msg?: string)` 把缺失固定转换为字符串错误。浅快照中只发现少量消费，且没有发现该模块的专门测试，因此不能把旧项目存在过等同于本项目兼容性和行为已验证。
4. 当前项目使用 `strict`、NodeNext module resolution 和 TypeScript 7 native preview。候选包 manifest 都携带类型声明，但本轮没有证明它们在当前 typechecker 与 Bun 构建入口下全部兼容。

**基于证据的推断：**

1. 一个 Result 实现加一个项目自有 Option，比并存多个 `Result` / `Either` / `Maybe` API 更能形成稳定代码方向。重复安装候选会让 AI 在同一问题上获得多个等价锚点，抵消预装依赖减少动态选择的目的。
2. `neverthrow` 的采用规模显著高于其他窄候选，包安装面又接近最小候选；即使发布频率低于 `true-myth`，当前证据仍足以支持把它作为已授权采用项。单 maintainer 和约 18 个月未发布是升级与安全复核条件，不是本轮否决理由。
3. 本地 Option 的 `toResult` 让普通缺失可以在领域边界升级为显式失败，但其字符串错误会限制错误类型。初次复制宜保持原语义，只完成导入适配和测试；是否改成泛型错误或惰性错误工厂，应由出现该需求的行为 owner 决定，不能在复制时顺手扩张 API。

**建议与尚未执行的动作：**

1. 在根项目预装并锁定当前 `neverthrow@8.2.0`。本仓库现有第三方源码依赖位于 `devDependencies`，最终使用形态若由构建器内联，建议沿用该归属；若分发模块保留外部 import，则必须另行确认对应 skill 的运行时安装责任。本报告没有执行安装或修改 lockfile。
2. 将 `line-rotating@3b00a58b06908c58c4bd81161c77d860fbc4f7fc` 的 `assets/libs/option.ts` 复制为项目源码，至少把 neverthrow import 改为包入口，并为 Some/None 类型收窄、组合、fallback、nullable 转换和 `toResult` 增加测试。本报告没有复制或修改源码。
3. 若该 Option 被确立为多个可分发工具共同使用的项目原语，推荐归属为 `tools/shared/src/option.ts`；这会把它提升为跨工具运行时 owner。当前 [`docs/tooling.md`](../tooling.md) 只允许 `tools/shared/` 承接已经真实共享的能力，而当前仓库尚无消费方，因此主线程在落地前仍需明确：是把“预置实现原语”纳入共享层契约，还是先放在首个真实消费方附近。不得为了满足路径建议而复制两份实现。
4. 不安装 `true-myth`、`purify-ts`、`oxide.ts` 或 `fp-ts`。`true-myth` 只在未来决定撤销本地 Option 维护、希望一个包统一承接 Maybe/Result/Task 时作为第一替代候选重新评估；其他候选需要新的目标或维护事实变化才重开调查。
5. 安装与复制完成后，至少运行 `pnpm install` 对应的锁文件检查、`bun run typecheck`、Option 单元测试及 `bun run check`。只有这些验证通过后，才能把“建议采用”更新为“已采用并验证”。

本结论适用于当前 Bun/TypeScript 工具仓库和“预置少量默认原语”的目标。下载量、stars、发布活跃度、最新版本、TypeScript preview 兼容性、依赖安全状态或源码 owner 规则发生变化时，应追加调查而不是沿用本次快照。
