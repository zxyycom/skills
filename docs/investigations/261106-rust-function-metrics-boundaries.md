---
title: "Rust 函数指标的词法与声明边界误判"
id: "261106-rust-function-metrics-boundaries"
formedAt: "2026-11-06T10:23:37Z"
question: "为何合法 Rust 会使函数指标不可用或失真，如何修复并界定验证范围？"
tags:
  - "function-metrics"
  - "gate"
  - "rust"
relations: []
---

## 形成时背景

2026-11-06 将 record-cli 的 Rust 维护代码纳入 Gate 指标时，函数指标在合法源码上以 `analysis-failed` 关闭，不能把其他检查通过视为覆盖。检查使用本仓库固定的 `@zxyycom/vibe-check` 0.0.5 与 pnpm patch，不更改上游或放宽门禁阈值。问题跨项目投影和第三方分析器边界，需要区分输入选择、词法和状态机失真。

## 调查目的

定位合法 Rust 输入触发的失效，修复实际责任边界，核对指标能否重新给出可操作的 finding；不试图证明支持 Rust 的全部语法。

## 调查范围与依据

- 检查项目 `scripts/lib/vibe-gate/checks/native.ts` 的 Rust 选择，以及随包 `RustReader`、共享 `GoLikeStates` 和指标消费者。分析器将空函数名视为不可信，故完整分析结果仍可能导致指标不可用；单改选择不能解决根因。
- 固定反例：反斜杠结尾或带多层 `#` 的 raw string 包含伪函数；结构体多个 `field: fn(&S) -> ...`；trait 中六参数无体声明后接六参数有体函数；一个函数指针形参中含七个类型，以及 `WriteContext<'_, '_, T, O>` 等嵌套泛型。原始分析器分别误切词、创建空名函数、把后续函数体归属原型、把内层逗号当外层参数。实际项目中前两种产生不可用结果，后两种使函数归属或参数数失真。
- 深度插件默认把 `?` 当三元运算，并在未加圆括号的逻辑表达式上累加隐式嵌套：Rust 的连续错误传播和 `if let ... && ...` 因而虚报深度。实际 `domains/investigation/document.rs` 与 `domains/investigation/body.rs` 的线性传播和条件链提供区分性样本。Rust 专用分支不把这些运算记为结构嵌套，仍保留环复杂度及实际嵌套分支的检查。
- 修复后公共 Gate 回归 `node --test scripts/tests/gate/code/vibe-check-code-coverage.test.ts` 七项通过：raw string 后仅报告六参数真实函数；混合声明样本仅报告两个六参数有体函数，不报告原型或嵌套参数。另以连续传播和逻辑链对照六层真实 if，前者不因深度阻断而后者仍命中。这个有限对照并非全部语法覆盖。
- 运行 `bun run check --scope repository-code`，2026-11-06 的一次并发工作区采样中函数指标不再 unavailable，而形成 360 条阻断 finding；文件指标 9 条、重复检测 27 条，密钥检测通过。其他 owner 同时改动 Rust，这些计数仅是该次快照，不是固定基线或最终验收。该命令整体失败，不能表述为门禁通过。

## 调查结果与边界

根因分别是通用转义字符串规则不符合 Rust raw literal 的结束语法，及 Go 风格状态机把每个 `fn` 当函数声明、未结束无体声明并把嵌套类型内逗号计作形参分隔。修复位于本仓库 `patches/@zxyycom__vibe-check@0.0.5.patch`：Rust 词法优先识别 raw literal，Rust 专属状态处理函数名、原型和嵌套参数；共享 Go 行为保留。源码、实际运行的 dist 与类型声明随补丁同步，离线 frozen lock 安装后验证，未向上游发布。

公共测试和实际 Gate 证明上述样本及本次工作区分析恢复，不证明所有合法 Rust 语法均被完整解析，也不证明所有 360 条 finding 均真实；需逐项审查，若出现新语法误判，应增加对应公开回归而非改写业务代码绕过。依赖升级时应检查上游是否已修复并复核补丁兼容性；回退此补丁将恢复上述错误，不能单独回退后声称 Rust 指标可信。
