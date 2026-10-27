# Gate 运行结果与诊断

本文供维护者排查本仓库 Gate 的执行、输入证明与性能结果；证明模型见[项目验证模型](validation-model.md)，命令、范围、预算和结算边界见[项目工具链](gate-execution.md#权威-vibe-门禁)。新增或修改 Check 时另读 [Gate Check 编写与接入](gate-check-authoring.md)。

## 从结果定位失败

每次 CLI 调用在 Git 忽略的 `.log/vibe-check/invocations/<timestamp>-<uuid>/` 中创建独立结果目录。先按 CLI 提示从项目根重跑失败 Check 的精确命令，再查看其 transcript；需要完整领域回归时使用对应 `test:*` 入口。

| 路径（相对本次目录） | 用途 |
| --- | --- |
| `machine/run.json`、`records.ndjson` | Vibe 本次 Run 与逐项事实；实际结算以原生结果为准。 |
| `machine/gate-incremental.json` | 执行、复用、fallback、first-run 计划计数与逐项原因、输入诊断和 receipt 发布结果；计划本身不证明执行或通过。 |
| `machine/gate-performance.json` | 请求与有效 scope、计划计数、原生结果、计时边界、实际执行样本统计和预算结论；计划执行数不表示 Check 已实际执行。 |
| `progress.log` | 原生终端进度副本。 |
| `checks/**/process.log` | 单个命令完整 stdout/stderr transcript。 |
| `diagnostics/core.log`、`scheduler.log` | 仅 `--diagnostic-log` 启用并回显。 |

增量计划中 `tool-triggered` 表示共享能力 flag 带入，`prerequisite-triggered` 表示成功前置带入，均计入 execute。quick 的 `counts` 覆盖必要 10 项（包括每轮执行的检查），`decisions` 只投影其中可复用证明条目，`completeChangePlan` 保留完整原候选；full/CI 的 `counts` 和 `decisions` 覆盖 base 66 项，不含未激活的 release 3 项。性能样本和阈值的准确含义见[性能报告与快速预算](gate-policy.md#性能报告与快速预算)。

## 输入证明诊断

以下诊断帮助定位问题，不改变当前范围内保守执行和拒绝发布部分证明的边界。公开路径与错误摘要先脱敏并归一化空白，再转义残留控制字符，每条最终最多 500 字符；完整原始命令输出留在 transcript，不放入 machine data、Records 或 progress。

- **输入可读取但未闭合**：终端 `Inputs unclosed` 与 machine `unclosedInputs.entries` 展示最多 5 条安全处理的仓库相对路径及 `{ path, reason }`；`unclosedInputs.total` 是总数，`unclosedInputs.omittedCount` 是省略数。`unknown-input` 表示输入域未知，`unowned-domain-input` 表示领域文件尚未归入能力：按[实际消费闭包](gate-check-authoring.md#项目输入证明)复核声明。`symlink` 和 `unsupported-file-kind` 需先修正输入身份。输入完整时计数为零，终端不追加该摘要。
- **快照读取或工具探测失败**：输入采集上限为 20,000 项、普通文件总量 512 MiB；超限、非 UTF-8 Git 路径、读取失败或必要工具链探测失败会触发回退。终端 `Snapshot fallback` 和 machine `fallbackDetail` 给出安全摘要；没有可投影的输入清单，`unclosedInputs` 为 `null`。全执行模式也不投影该清单。回退在当前有效范围保守执行，不发布部分证明。

本地 invocation、history 和 cache 是可丢弃状态，目前不自动清理；缺失只增加后续执行成本。删除前仍须确认目标及授权。
