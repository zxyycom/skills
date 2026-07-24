---
title: 按测试入口映射证据并触发范围审查
status: active
alignment: aligned
createdAt: 2026-07-20T13:48:52+08:00
purpose: 让每个被发现器识别的测试入口都能回到明确契约和 case，消除文件级标记造成的遮蔽，并让人工审查范围在 Git 变化后可确定地重新触发。
background: 文件级最小归属会让一个 marker 覆盖同文件内未评估的其他测试；case 缺少契约背景，普通三级标题会被误判；Scope 只校验路径外形，无法发现失效范围或命中变更。
decision: case 使用固定标题和 `Contract:`；源码角色逐测试入口映射；Scope 用严格 glob 与 Git 路径校验，并按变化和 CR 基线触发 review。
relations:
  - type: 修订
    target: test-evidence-review-behavior/260719-model-verification-obligations-and-source-roles.md
---

## 目的
- 让每个被发现器识别的测试入口都拥有且只拥有一个可追溯 case 映射，避免同文件其他测试被已有 marker 遮蔽，并让误报只能按入口豁免。
- 让账本保存重新评估测试价值所需的契约背景，同时继续按稳定契约和共享测试基座组织 case。
- 让人工 review 的范围、最近结果和代码基线能够被机械检查，并在相关 Git 路径变化后显式触发检查动作。
- 让 case 与普通 Markdown 结构具有确定、可扩展的语法边界。

## 背景
- 既有 CLI 只判断文件是否包含常见测试语法；文件中出现任意 main、derived 或 exempt 后，整个文件不再作为未登记结果报告，因此一个 marker 可能遮蔽多个无关测试入口。
- main 与 derived 的角色模型已经允许多个源码位置归入同一 case，但同文件内重复 derived 被禁止，无法表达入口级多对一映射。
- `Proves:` 能表达叶子结果，却不能独立恢复当前 case 需要固定的契约背景；代码路径只能定位实现或测试，不能替代文字行为说明。
- 所有三级标题都被解析为 case，限制了账本文档结构，也会把示例或普通说明误判为非法 case。
- review `Scope:` 只检查反引号和相对路径，不能证明 glob 合法、范围仍对应 Git 路径，也不能确定当前工作区或最近 CR 之后是否发生了范围内变化。

## 决策
- 采用: `Case` 是三级标题的保留前缀；fenced code block 外以该前缀开头的标题固定使用 `### Case <CASE-ID>: <title>`，ID 是无空白、无冒号且符合项目 pattern 的单个 token。不以 `Case` 开头的标题是普通 Markdown 结构。
- 采用: automated、planned 和 review case 使用非空 `Contract:` 列表，以文字说明需要长期固定的行为、边界或不变量；`Contract:` 不记录决策人，也不以代码路径代替契约语义。exempt 继续只记录 Scope 和误报原因。
- 采用: 发现器返回每个识别出的测试入口位置；每个入口必须且只能绑定一个紧邻的 `@test-evidence main|derived|exempt CASE-ID`。一个 automated case 仍只有一个 main，其他入口使用 derived；同一文件可以让多个入口重复引用同一 case。exempt 只豁免紧邻入口，不再按整文件生效。
- 采用: 账本继续按稳定契约、共享测试基座和行为链路组织，不因入口级 marker 而按测试函数建立 case。
- 采用: 存在 Scope case 时以 Git worktree 根目录作为 `--root`；`Scope:` 使用 picomatch 严格括号模式解析正向 glob，并要求每个 pattern 至少匹配一个 Git tracked 或非 ignored untracked 路径；exempt marker 的路径必须由对应 Scope 覆盖。
- 采用: review case 可以同时保存 `Review-Result`、`Reviewed-At` 和 `Reviewed-Commit` 作为最近一次可持久化 CR 状态。CLI 在脏工作区路径或该 commit 之后的已提交路径命中 Scope、最近结果不是 pass、尚无最近 CR 或提交基线不可读取时返回 review trigger；配置决定 trigger 是 warning 还是 error，时间阈值只产生长期未复核提醒。
- 采用: CLI 只发现、校验和返回 review trigger，不执行测试、不判断契约或证明点价值，也不代替人工 `Review:` 动作；调用 skill 的 agent 继续负责语义评估和命中动作。
