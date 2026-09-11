---
title: "固定可选 peer 缺失语义使 Bun 分发构建不受祖先目录污染"
id: "260911-bound-bun-optional-peer-resolution"
formedAt: "2026-09-11T05:49:11Z"
question: "为什么 Task Graph portable build 会受 /tmp/node_modules 影响，如何让同类分发构建只由声明依赖决定？"
tags:
  - "bun"
  - "repository-tooling"
  - "task-graph"
  - "test-hermeticity"
relations:
  - type: "补充"
    target: "260911-explain-ci-cold-proof-test-failure"
    summary: "闭合前序留下的 Task Graph 本地构建失败"
---

## 形成时背景

修复 `test:check` 的 CI 环境耦合后，本地完整 `bun run check` 中原失败项已经通过，
但 `Task Graph portable build` 仍稳定失败。失败来自
`scripts/lib/source-map.ts` 的既有边界检查：Task Graph bundle 的 source map 新出现
`../node_modules/supports-color/index.js`，位于该测试创建的隔离 checkout 之外。
前序调查 `260911-explain-ci-cold-proof-test-failure` 已明确把它识别为另一个本机环境问题，
没有把它混入 CI 连续失败的根因；用户随后要求为该 Bug 独立形成报告并直接修复。

portable-build 测试原本会在系统临时目录下建立两个不同长度的 checkout，只复制根
manifest 中列举的依赖闭包，然后比较真实生成入口的 bundle、source map 和声明树。
调查时项目根 `node_modules` 没有 `supports-color`，但宿主
`/tmp/node_modules/supports-color` 存在 `9.4.0`。因此要区分的是：fixture 是否漏复制了
必要依赖、source map 是否错误拒绝合法来源，还是构建解析越过了 fixture 的依赖边界。

## 调查目的

解释一个隔离 checkout 的 Bun 构建为何仍会受 `/tmp/node_modules` 影响，闭合
`supports-color` 如何进入 source map 的因果链；据此选择既不掩盖越界来源、也不依赖
调用者临时修改 `TMPDIR` 的修复。修复范围覆盖仓库中实际经
`simple-git → debug` 引入同一可选 peer 的分发 bundle，并建立不依赖本机现状的回归证据。
本轮不尝试改变 Bun 的通用模块解析规则，也不把一个已知可选 peer 的处理外推为对任意
未来依赖树外包的自动隔离。

## 调查范围与依据

- 读取 `tools/task-graph/tests/portable-build.test.ts` 及 fixture helper。两个 checkout
  都位于 `os.tmpdir()` 下同一临时根中；依赖复制只递归普通 `dependencies`，不复制
  peer dependency，符合该 fixture 要证明声明依赖闭包可移植的目的。
- 读取 `pnpm-lock.yaml` 和已安装的 `debug@4.4.3`。`simple-git@3.36.0` 依赖
  `debug@4.4.3`；后者把 `supports-color: "*"` 声明为 optional peer，并在
  `src/node.js` 的 `try/catch` 中以 `require("supports-color")` 探测它。
- 读取 `scripts/lib/generated-file.ts` 与 `scripts/lib/source-map.ts`。共享 bundler
  无论走 `bun build` 子进程还是带 plugin 的 `Bun.build`，都请求打包 packages，但没有固定
  optional peer 的解析结果；source map 规范化器则有意拒绝 workspace 外来源。放宽后者只会
  隐藏宿主文件已进入产物的事实，不能恢复可复现构建。
- 在未修复状态直接运行 portable-build，稳定得到 0/1，并在 source map 规范化时拒绝
  `../node_modules/supports-color/index.js`。保持源码不变、只把 `TMPDIR` 指向没有祖先
  `node_modules` 的 `/var/tmp` 隔离目录后，同一测试为 1/1。该单变量对照排除了
  checkout 长度、声明生成和随机时序是必要原因。
- 检查全部共享 bundler 调用和生成产物。Change Plan、Decision Records、
  Investigation Report、Skill Validator、Task Graph 与 Test Evidence 六个 bundle
  都含 `simple-git` 的 `debug` 可选加载；在宿主未解析到 peer 时，旧产物把该加载编译为
  会在 `try/catch` 内抛出的缺失模块分支。Skill updater 与 MCP Shell Workspace Bridge
  的产物不含这条依赖链，不需要声明该 optional peer 的缺失语义。
- 修复后的 portable-build 在两个 checkout 的共同祖先主动创建带唯一 marker 的
  `supports-color` fixture。这样即使运行机的 `/tmp` 干净，测试也能稳定覆盖祖先依赖污染，
  并同时断言产物不含该 marker。

## 调查结果与边界

### 根因与取舍

根因链已经闭合：Bun 从 checkout 内的 `debug` 解析可选 `supports-color` 时按模块查找
规则继续向祖先目录上溯；本机 `/tmp/node_modules` 恰好满足了这次探测；`packages=bundle`
于是把宿主包纳入 bundle 和 source map；严格的 source map 边界检查最后把这个已经发生的
非密封构建显露出来。前序记录中的 CI run 未出现同一越界来源并通过该 Check，说明其当次
runner 没有向 Bun 暴露相同的祖先包解析结果。
这也解释了为什么清理祖先包或更换 `TMPDIR` 可以让测试暂时变绿，却不能保证构建结果只由
仓库声明输入决定。

本轮保留 source map 越界拒绝，并为共享 `BunBundleOptions` 增加只读的
`unsupportedOptionalPackages` 配置。共享 bundler 为这些精确包名建立解析 plugin，统一映射到
仓库内的 `scripts/lib/unsupported-optional-package.ts`；该模块在加载时抛错，由 `debug` 既有的
`try/catch` 按“optional peer 不可用”处理。上述六个构建入口各自声明
`unsupportedOptionalPackages: ["supports-color"]`。因此构建机和分发运行环境是否在祖先目录
安装该包，都不会改变 bundle 的内容或行为；stub 会被内联，产物仍只依赖目标运行时和包内内容。
显式配置只出现在实际包含该依赖链的 builder，避免共享 bundler 无条件改变未来可能成为正式
依赖的同名包。

### 实际修改与当前证据

- 六份 builder 源码和共享 bundler 已更新；相应 `.mjs` 与 `.map` 已通过各自 `sync:*`
  入口重建。产物内联受管的 unavailable stub，不包含宿主 fixture 实现，也不保留对
  `supports-color` 的运行时外部依赖。
- Task Graph portable-build 最小原生测试入口已扩展为同时覆盖 checkout 路径与祖先
  optional peer，并在人工污染条件下通过 1/1。`TASK-GRAPH-DISTRIBUTION-004` 保留原 Case
  身份，更新了重命名后的实体 ID、Contract 与 Proves；Case 索引已同步，当前项目
  Test Evidence 引用和覆盖检查通过，共识别 827 个实体。
- 六个生成产物 `check:*` 全部通过；Task Graph 完整测试通过 88 个 Bun 测试和 4 个
  Node 原生锁测试；`typecheck`、`lint` 与 `format:check` 均通过。最终 `bun run check`
  实际执行 59 项并全部通过，另有 3 项仅 release 条件启用的检查未运行；其中原失败的
  `Task Graph portable build` 和前序修复的 `Script: test:check` 都已通过。

这些证据证明当前 `supports-color` 可选 peer 不再使六个已识别分发构建吸收祖先实现，且原
Task Graph 路径复现已关闭。它不证明 Bun 不会对其他动态或未来 optional peer 做祖先解析；
新增类似依赖链时仍须由相应 builder 明确决定内联、固定为不可用或作为正式依赖打包。
截至报告形成，没有运行 release-only 的版本快照、版本授权和打包，
也没有提交、推送或触发新的远端 workflow；若后续环境对其他 optional peer 暴露相同现象，应按
新的依赖链和生成入口重新界定。
