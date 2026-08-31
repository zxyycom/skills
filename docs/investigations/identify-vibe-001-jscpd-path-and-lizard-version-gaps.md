---
title: "识别 Vibe 0.0.1 的 jscpd 路径与 Lizard 版本缺口"
formedAt: "2026-08-31T10:05:00+00:00"
question: "锁定 @zxyycom/vibe-check 0.0.1 时，重复检测的临时配置相对路径和函数指标的 Lizard 可用性是否足以形成可信门禁？"
tags:
  - "duplicate-detection"
  - "function-metrics"
  - "vibe-check"
relations: []
---

## 形成时背景

Change `replace-workspace-gate-with-vibe-check` 准备以 `@zxyycom/vibe-check` 承接仓库权威门禁。形成时，`package.json` 声明 `^0.0.1`，而 `pnpm-lock.yaml` 将其解析为精确的 `0.0.1`。该版本的 file metrics 会精确比对 SCC 版本输出 `scc version 3.7.0`，但 function metrics 对 Lizard 的可用性只要求 `--version` 命令成功且输出非空。

本轮同时发现 Vibe 的 jscpd scanner 将临时 config 写到系统临时目录，却把所选文件路径原样写进 config 的 `path`。jscpd 按 config 所在目录解析相对 `path`，因此项目根为工作目录并不能让它扫描到这些相对路径所指的项目文件。

这是形成时问题调查，不是 Change 完成、合并或运行时生效的证明。并行工作树中可能存在兼容实现；本报告不将其存在、测试或未提交字节视为修复已完成的事实。

## 调查目的

独立复核下列两个问题的触发机制、最小可复现结果与门禁影响，并给出不扩大 Vibe 公共 API 或不复制其实现的最小兼容方向：

1. `duplicateDetection` 对项目根外临时 jscpd config 中相对文件路径的真实解析。
2. `functionMetrics` 在 Lizard `1.23.1` 输出兼容 CSV 时为何仍可形成 `passed` aggregate。

本轮不修改 Change、Vibe 依赖、门禁实现、环境探测、测试或 CI，也不判断上游版本之后的行为。

## 调查范围与依据

### 实际版本与源码依据（事实）

- `pnpm-lock.yaml` 的 importer 与 package resolution 均为 `@zxyycom/vibe-check@0.0.1`；本地安装包 `package.json` 同样声明版本 `0.0.1`。
- 该包的 `src/package-checks/file-metrics/scc/parser.ts:7-8` 固定 `SCC_VERSION = "3.7.0"` 与精确版本输出；`scc/availability.ts:45-67` 仅在输出全等时才标记可用。
- `src/package-checks/function-metrics/lizard/availability.ts:24-65` 执行 `<executable> --version`，拒绝信号、进程错误、非零退出和空输出，却在任意其他非空输出时返回 `{ available: true, version: output }`；其中没有 `1.23.0` 常量或等值比较。
- `function-metrics/measurement.ts:30-36` 在该 availability 为 true 后继续扫描；`lizard/scanner.ts:30-54` 用 `<files> --csv` 扫描并接受成功退出后的 CSV parser 结果。因此版本字符串本身不是扫描前的 compatibility gate。
- `duplicate-detection/jscpd/scanner.ts:153-172` 通过 `mkdtempSync(join(tmpdir(), "quality-jscpd-"))` 在项目根外创建临时目录，并把未转换的 `files` 写入 `config.path`，随后从项目根 `cwd` 以 `--config <temp>/.jscpd.json` 启动 scanner（该文件的 `60-76` 行）。

以上路径均指本工作区安装的锁定依赖；它们是形成时外部包源码证据，不是本仓库的长期行为 owner。

### 最小复现（实际动作与观察）

在隔离的 `/tmp` 目录创建项目根，写入两份完全相同的 `first.ts`、`second.ts`，并从该项目根调用 Vibe 所解析的 jscpd `run-jscpd.js`。两份 config 的阈值均为 `minTokens: 10`、`minLines: 2`，唯一差异是 `path`：

```text
相对 config：path = ["first.ts", "second.ts"]，config 位于 /tmp/.../config-relative/
绝对 config：path = ["/tmp/.../project/first.ts", "/tmp/.../project/second.ts"]，config 位于 /tmp/.../config-absolute/
```

观察结果为 `relative-config duplicates=0`、`absolute-config duplicates=1`。两次均用同一 jscpd executable、项目内容和阈值；这直接证明 config 目录会改变相对 `path` 的目标，而非项目 `cwd` 自动纠正它。

另在隔离目录把 `PATH` 首项设为 fake `lizard`：`--version` 输出 `1.23.1` 并以退出 0 返回符合 Vibe 解析器列头的单行 CSV。调用锁定包的 `functionMetrics`（`filesystem` 选择一个 `.ts` 文件）及 aggregate `{ checks: "all", empty: "failed", mode: "all", notApplicable: "fail", unavailable: "fail" }`，观察到：

```text
aggregate=passed
outcome=passed
```

这不是对真实 Lizard 1.23.1 行为、所有 CSV 差异或生产 PATH 的证明；它只证明该版本的 availability 和 parser 接口允许一个报告 1.23.1 且提供兼容 CSV 的 executable 错误通过。

## 调查结果与边界

### 已确认事实

1. Vibe 0.0.1 的 SCC availability 是精确版本契约，Lizard availability 则不是；二者不对称。
2. 当 Vibe 给 jscpd 临时 config 写入 project-relative path 时，config 位于项目根外足以让真实重复文件变成零 finding；blocking duplicate check 因而可能错误通过。
3. Lizard `1.23.1` 的非空版本输出和兼容 CSV 可让 `functionMetrics` 结算为 `passed`，即使 Change 的环境契约要求 `1.23.0`。由于 function metrics 是 advisory finding，问题不在 finding 的阻断策略，而在不兼容工具被当作可信测量成功。

### 推断

若这两个缺口直接进入权威 `bun run check`，门禁的“无重复”与“函数指标已实际由指定 Lizard 契约扫描”主张都可能超出实际证据。前者漏报 blocking finding，后者把不受版本约束的 scanner 结果提升为可用结果；full 选择若依赖 aggregate passed，还可能继续到后续打包。

### 形成时的最小兼容方向（建议）

1. 仅为 duplicate scanner 提供项目自有的轻量 executable/adapter：在调用 jscpd 前读取 Vibe 生成的 config，将其中每个相对 `path` 按 scanner 的项目 `cwd` 规范化为绝对路径，再原样转交其余参数和 jscpd。不要复制 Vibe 的 duplicate parser、file selection、aggregate 或 renderer。
2. 仅为 function metrics 提供一个 executable wrapper：对唯一参数 `--version` 强制输出必须精确为 `1.23.0`，不匹配时以非零退出；其他扫描参数原样转交 Lizard。让 Vibe 继续拥有 availability、CSV parser 与结果结算，从而把版本不匹配自然结算为 unavailable。
3. 两个 wrapper 均应有隔离回归：真实重复 + 项目根外 config 必须产生 finding；fake `1.23.1` + 有效 CSV 必须 unavailable，且 full 打包不得启动。接受 `1.23.0` 时应证明扫描参数和 CSV 不被 wrapper 改写。

### 已知边界与重新调查条件

- 未审计 `@zxyycom/vibe-check` 的其他版本、上游 jscpd 的所有 config 解析模式、Windows 路径差异、符号链接、缓存或真实 Lizard 1.23.1 的全部 CSV 兼容性。
- wrapper 的跨平台进程转发、异常退出、信号语义和实际 Change 集成需要由实现与测试 owner 独立验证；本报告不替代这些证据。
- 若锁定 Vibe 或 jscpd/Lizard 版本改变、Vibe 改为将 config 放在项目根或写绝对 path、上游开始精确校验 Lizard，或项目要求支持非标准 scanner executable/输出时，必须重新调查并重新选择兼容边界。

本轮实际动作仅为只读源码核对与已清理的 `/tmp` 最小复现，以及创建本 Investigation Report；没有安装依赖、修改生产行为、启动 CI、写入外部系统或宣称任何修复已生效。
