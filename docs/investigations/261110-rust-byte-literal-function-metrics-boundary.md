---
title: "Rust 测试字节字符写法与函数指标边界误计"
id: "261110-rust-byte-literal-function-metrics-boundary"
formedAt: "2026-11-10T08:04:13Z"
question: "为何资源诊断测试的短函数被门禁识别为 256 行，等价字节写法是否能恢复函数边界？"
tags:
  - "function-metrics"
  - "record-rust"
  - "rust"
  - "tooling"
relations: []
---

## 形成时背景

2026-11-10 为调查资源诊断增加原生回归时，Rust 编译、clippy 和原生测试通过，但 `bun run check -- --scope record-rust` 的函数指标把 `tools/record-cli/tests/authoring/resource_advisories.rs` 中第一个测试函数识别为 256 行，超过低复杂度测试允许的 250 行。该函数的形成时源码范围为第 60–88 行，后面是其他独立 `#[test]` 函数，不是一个大函数。

门禁依赖为 `@zxyycom/vibe-check@0.0.5`，内置启发式 reader 声明基于 Lizard 1.24.1。它不是 Rust AST 或完整语法保证。本轮核对测试输入、Rust token reader 与指标结算之间的边界。

## 调查目的

确定异常是否来自真实长函数、非文本字节字符串，还是字符与生命周期 token 处理；在不降低门禁、不修改第三方依赖、不改变资源诊断行为的范围内，使本轮验证恢复可用。第三方 reader 修复及影响范围留待依赖 owner 调查。

## 调查范围与依据

- 实际读取项目 `docs/gate-policy.md`、依赖随包 `docs/checks/function-metrics.md`，以及已安装 reader 的 `readers/rust.mjs`、`shared/code-reader.mjs` 和 `shared/golike.mjs`。项目指标同时受函数边界与启发式 token 流影响，不能把 finding 直接当成 AST 函数长度。
- 两次真实门禁分别报告同一短测试的 `function-code-density = 256`；同时所有原生测试通过。先把 PNG 的转义字节字符串改成等价数字字节数组，该 finding 仍为 256，因此不能归因于 PNG 转义串本身。
- 随后只把新测试文件中的 ASCII 字节字符填充值改成等价十六进制字节，例如 `vec![b'a'; 65536]` 改为 `vec![0x61; 65536]`；对 a/b/c/d/x/y 的内容和差异位置均保持原值，没有删除断言、拆走被测行为或改变产品实现。再次执行同一门禁，21 项所选检查全部通过，函数与文件指标无 finding，原生回归仍通过。
- 形成时十六进制版本测试文件 SHA-256：`f72d42f340e7ec73b5fb81ecae1c4cd71b8620871c726e088d60fd4e6eb261ca`。这是形成时未提交工作区的文件身份；完整失败输入未另行固定。
- reader 的 Rust addition 将 `(?:'\w+\b)` 用作生命周期候选，并在共享字符字面量规则前参与匹配。由源码推断，字节字符的开头可能先被当作生命周期，留下的单引号再影响后续 token／函数关闭范围。该机制与跨函数累计及等价字节写法对照一致；本轮没有直接执行私有 tokenizer 或完成最小独立 fixture 复现。

## 调查结果与边界

已确认：本轮阻断是函数指标的源码边界误计，不是该测试实际含有 256 行，也不是原生测试失败。等价十六进制字节写法使本轮门禁恢复；没有修改依赖、增加 waiver、放宽阈值或减少行为保护。

字符与生命周期 token 顺序是有源码依据的机制解释，尚未证明所有 Rust 字符、生命周期、宏与嵌套写法的影响范围。本轮动作是当前输入的兼容规避，不是第三方 reader 修复，也不新增“Rust 测试必须使用十六进制字节”的长期规则。后续若更新门禁、恢复字符写法或再次看到跨函数异常，应先用等价输入对照与原生编译确认边界，再在依赖 owner 调查；不以虚假长函数 finding 机械拆分测试。

门禁输出已在正文保留必要指标和对照，不随附完整运行日志或依赖副本。复核可恢复指标与对照结论，重放仍依赖形成时 reader 和完整输入。
