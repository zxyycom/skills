---
title: "定位 Gate 工具链漂移导致的级联失败"
id: "260919-gate-toolchain-drift"
formedAt: "2026-09-19T11:27:05Z"
question: "为什么权威 check 在本地同时出现生成漂移、测试失败和 SCC unavailable？"
tags:
  - "project-tooling"
  - "vibe-gate"
relations: []
---

## 形成时背景

2026-09-19 在仓库根目录运行 `bun run check` 时，Gate 完成 62 项定义中的 59 项 base 尝试，结果为 45 passed、10 failed、4 unavailable、3 release-only not applicable。直接症状同时包含多项分发 bundle “missing or not generated”、两个 Task Graph 断言失败、Gate metrics 测试失败，以及 SCC file metrics unavailable。工作区当时只有五个既有的未跟踪 `changes/` 目录，目标源码和生成产物没有已跟踪修改。

仓库 `package.json#engines.bun` 当时声明 `>=1.3.14`，环境检查因此把本机 Bun 1.4.2 视为 ready；CI workflow 和最近生成产物实际使用 Bun 1.3.14。SCC 3.7.0 与 4.0.0 都已安装在 mise 中，但活动配置没有为 `scc` shim 选择版本。

## 调查目的

区分当前源码回归、未跟踪 Change 输入、Bun 生成与测试语义变化，以及 SCC 安装或选择状态，解释为什么一个基础环境偏差会表现为多个 owner 的独立失败，并确定 Gate 应在哪个边界阻断这类漂移。

## 调查范围与依据

- 读取 `package.json`、`.github/workflows/package-skills.yml`、`docs/tooling.md`、环境入口、Gate CLI、增量工具链指纹、生成适配器和三个失败测试的直接实现。
- 原始 `bun run check` 使用 Node 26.8.2、Bun 1.4.2、pnpm 11.7.0 和未选中版本的 mise SCC shim，并产生上述失败汇总；可丢弃的 invocation 日志不作为长期报告资源保存。
- 用 Bun 1.4.2 重建单个 Change Plan bundle 后与 Git 基线比较，再立即恢复该路径。代码和 source map 均发生大范围字节变化，证明生成校验失败不是文件缺失，而是 Bun bundler 输出漂移。
- 保持 Node 26.8.2 和相同工作区不变，只用 `mise x bun@1.3.14 'go:github.com/boyter/scc/v4@4.0.0' -- bun run check` 切换 Bun 与 SCC。结果为 59 passed、0 failed、0 unavailable、3 release-only not applicable。
- 单独检查失败断言：Bun 1.4.2 的 `node:assert/strict` 会区分 `Object.create(null)` 产生的 JSON-safe detail 与普通对象，而 Task Graph 实现本来就有意返回无原型对象；Bun 1.3.14 未让这两条断言暴露原型差异。
- `scc --version` 实际解析到 mise shim，但 shim 因没有活动版本而退出 1，并列出已安装的 SCC v3/v4 候选；因此问题不是仓库找不到可执行路径，也不是 SCC 4.0.0 尚未安装。
- 修复后再次让 SCC 保持未选择状态运行 base Gate，只产生一个 `gate-environment` failed outcome；59 个 base impact Check 均以 `dependency-not-passed` 停止且没有执行。随后在精确 Bun 1.4.2 与 SCC 4.0.0 下运行完整 base Gate 和 cold release Gate，分别得到 60 passed、3 release-only not applicable，以及 63 passed。

## 调查结果与边界

已确认根因是环境契约与实际可复现工具链不一致：仓库把 Bun 表述为最低版本范围，却用固定 Bun 1.3.14 生成并在 CI 验证字节；较新的 Bun 1.4.2 合法通过环境检查后，既改变 bundler 输出，也让原有测试开始正确观察无原型对象。与此同时，未选择版本的 mise SCC shim 使工具链快照退化并让 file metrics unavailable。增量 Gate 当时对必要工具探测失败采取“全量执行”策略，所以一个基础环境问题扩散成多个生成、测试和指标症状。

本轮采用以下修复边界：把 Bun 升级并精确固定为 1.4.2，CI、环境 setup、fixture 与生成产物使用同一版本；保留 SCC 4.0.0，但让诊断区分“激活到 PATH”与“安装”；在完整 Gate Definition 中加入每次执行的 `gate-environment` Check，让其他全部 Check 显式依赖它。该 Check 直接复用 `scripts/environment.js gate`，只覆盖 Git、Node、Bun、pnpm、SCC，不复制版本判断，也不把 CodeGraph、hooks 或完整开发环境错误地变成 Gate 前置；Task Graph 测试显式验证既有无原型对象契约。

完整 `scripts/environment.js check` 与 `setup` 本来就覆盖这些基础工具，并继续负责项目依赖、CodeGraph、索引和仓库 setup。Vibe 环境 Check 选择复用其窄 `gate` action，而不是调用完整 `check`：否则尚未准备的维护便利条件会阻断质量门禁，且项目依赖缺失时 Gate 自身无法启动，形成循环。环境失败现在表现为带原始诊断 transcript 的真实 failed Check，依赖它的业务 Check 不启动；activation 仍可先保守形成计划，但失败运行不会发布成功 receipt。

该结论不证明任意未来 Bun 版本兼容，也不建议用版本范围替代精确生成工具身份。升级 Bun 时仍需重新生成全部受影响 bundle、运行 base/release Gate，并按 skill 版本门禁提升发生版本承载变化的包。SCC 的 mise 恢复命令只适用于 mise 用户；其他工具管理器只需让精确 4.0.0 的 `scc --version` 在当前 `PATH` 成功。
