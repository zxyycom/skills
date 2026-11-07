---
title: "Rust 记录工具实现与语法普查"
id: "261107-rust-record-idiomatic-implementation-review"
formedAt: "2026-11-07T10:14:40Z"
question: "Rust 记录候选中哪些内部表达值得惯用化而不改变对外契约？"
tags:
  - "maintainability"
  - "record-cli"
  - "rust"
relations: []
---

## 形成时背景

2026-11-07 对 Rust record CLI 候选的定向审阅，关注内部表达与对外契约。同轮随后补做完整源码普查，避免将热点观察外推全仓。Rust 是候选而非生产 TypeScript 入口；既有 JSON、通道和实际部分写事实是改写边界。

## 调查目的

识别无需新库的实现改进，区分可建议修改的具体问题与依赖契约确认的候选。库和依赖取舍见[通用库职责普查](./261107-rust-record-library-replacement-survey.md)。

## 调查范围与依据

补充普查的基线是 2026-11-07 10:55 UTC 采集的 commit `e03e9e87e937029c3058456cfb88d600e1f88ed7`。五名 gpt-6.1-terra 按分区全文阅读`tools/record-cli/src` 和 `tools/record-cli/tests` 下受版本控制的 280 个 Rust 文件（分别为 249 和 31 个，共 38,815 行）及 17 个关联输入；另一名同模型 reviewer 逐项复核 13 项发现并抽样。主代理完成路径、哈希和行范围闭合；机械闭合不等于独立重读全部源码或保证零遗漏。

这是静态源码普查，未运行新测试、替代构建或性能采样，也不是逐测试入口价值审核。共享资源 `source-census.json` 保存逐文件责任、完整行范围、SHA 和判断；`findings.json` 保存各发现的定位、建议、验证要求和独立复核。账本的 `retain` 仅表示未发现应库化或惯用化的调整，不证明行为正确。资源供进一步核对，不是动态验证结果。

## 调查结果与边界

13 项发现中有 8 项建议修改、5 项待验证候选。本篇承接 7 项修改和 3 项候选；另外 1 项依赖修改、2 项库候选见[库职责普查](./261107-rust-record-library-replacement-survey.md)。建议涵盖行为、测试条件和维护性，并非全部为产品 bug；候选需先确认或比较。

### 应改：可见行为与测试条件

- **CLI-002：分域修正帮助。** 两域共享的 discard/publish 帮助与各自实际接受的 selector 和选项不一致；应反映现有语法，而非改变语法。
- **CLI-003：返回实际索引路径。** selected 失败上下文硬编码索引 basename，导致失败 JSON 的 `indexRelativePath` 不反映配置路径；应复用已验证的工作区相对路径。
- **CLI-004：统一 symlink fixture 条件。** 创建 symlink 只在 Unix 执行，专属诊断断言却无条件执行；建议整个测试函数使用 `cfg(unix)`。这是测试条件不一致，不是已证明的 Windows 产品失败；当前 Windows 承诺是 release 构建与 smoke。

### 应改：复用规则与明确数据流

- **AUTHOR-003：复用 `is_kebab`。** 现有重复判定等义；复用时保留路径和错误语义。
- **OPS-003：复用 `JsTrim`。** 重复字符表表达 ECMAScript whitespace；复用时仍需检查原始值的 CR/LF，并保留修剪后长度边界，不能改用 Rust 默认 trim。
- **OPS-002：让成功值通过 `Result` 返回。** selected sync 当前借可变 `Option` 副作用取回校验结果，再用 `unreachable` 表达必然有值；显式返回值更清晰。现有成功路径会执行回调一次，未证明可触发 panic。
- **OPS-001：单次 prepare 复用基线快照。** 当前一次准备中两次读取解析基线，选择和写集来自两次观察；可传递同一快照，但必须保留第二路径承担的图验证、selector/review 相关失败顺序和独立调用入口。preflight 与 execute 仍各自独立 prepare。

### 候选：先确认边界

- **MODEL-001：BOM 兼容。** show 在身份提取前剥除 BOM，content 不剥；正式报告要求 frontmatter 首行开始，不能据 show 的宽容行为认定 BOM 来源合法。先由 owner 确认只读兼容边界。
- **AUTHOR-002：身份发现的读取范围。** 回退发现会完整解码所有合格成员，未选正文无效也可能阻断；先由 owner 确认这种情况下的处置，再比较只读取头部。
- **AUTHOR-001：显式穷尽关系转换。** 泛型关系经 JSON 值转换后使用 `unwrap`，可比较穷尽转换；现有关系类型并未证明当前存在 panic。

### 保留及认识转折

基线 clone、非递归图遍历及规范化到原文 UTF-16 的映射分别服务候选隔离、深图和定位，不能仅为语法简化而消除。最初定向审阅将 Debug 映射和输出 DTO 列为优先试点；全量普查未发现证明它们比上述具体问题更迫切或 DTO 有净收益的证据，因此撤回优先级。

本轮尚未实施；具体验证清单见发现资源。

## 随附资源

- [发现与独立复核目录](./_resources/261107-rust-record-library-replacement-survey/findings.json)
- [逐文件普查与关联输入账本](./_resources/261107-rust-record-library-replacement-survey/source-census.json)
