# Record CLI 候选性能测量

本方法不是性能结论或通过证明；应在最终稳定源码上隔离重建、核对和测量。

## 输入与正确性

输入仅在 `dist/record-benchmarks/` 的新建私有目录中生成，不使用真实记录：

```bash
node tools/record-cli/benchmarks/fixtures.ts <新目录名> <条数> [宽度] [深度]
```

条数不超过 10000，且不少于 `10 + 宽度 + 深度`；宽度至少 2、深度至少 1。生成器写入两域 Markdown，依次运行各旧 CLI 完整 `sync-index` 和 `check`，任何失败中断，保留目录诊断，不覆盖已有目录。图包含拆分、链、DR 重划／IR 归并，以及宽度和深度可调的归并与链；当条数不少于 `11 + 2 * 宽度 + 深度` 时另有 IR 普通宽分支。其余记录无边。验收记录总条数、边数、宽深、事件形状和输出字节数，不能把无边填充当作图规模变化。

`verify.ts` 定义独立预期：list 和 metadata/content search 的预期 ID、总数或完整性；trace 的 trace/context/frontier/coverage 和复杂事件。运行器对每个场景先用旧 Node CLI 和原生 CLI 验证，再对旧 CLI 已有的 trace JSON 整对象比较（对象键顺序不影响语义）。list/search 的旧 CLI 文本按实际输出提取 ID 并核对，原生 JSON 验 ID 和覆盖范围；这些输出不是同形结果，不能冒充逐字段差分。校验过程和两边 stdout 保存在 `correctness.json`，任何不符中断测量。每个计时只读输出也须与已验证输出哈希相同。同步场景以各自私有副本删除索引后全量重建：比较重建索引与旧 CLI 基准的原始字节、复核其他文件不变，再以旧 CLI `check`；这不证明其他 mutation 或生产数据。

## 新进程测量

在最终稳定源码上，通过公开 delivery 入口新建隔离 release 快照并生成 manifest：

```bash
node tools/record-cli/delivery/cli.ts build <新构建名> 0.1.0
node tools/record-cli/benchmarks/run.ts <fixture名> dist/<构建名>/assets <新运行名> 20 <非零随机种子>
```

运行名必须新建；失败产物不覆盖或自动清理。每个场景两端各一次预热，之后按记录的种子随机交错；正式报告至少每臂每场景 20 个样本，按中位数和 nearest-rank P95 汇总。少样本只用于方法初测，不当作分布结论。每次调用是独立的新 Node CLI 或 release 原生 CLI 进程，墙钟从启动到完整收集输出；没有 `cargo run`、额外 Bun 启动或常驻多请求。同步每样本的复制、索引删除和写后验证在计时之外；输出的逐次命令、退出状态、stdout/stderr 字节数与哈希以及时序保存在 JSONL。

执行前后守卫 fixture、候选资产及 manifest、两域旧 CLI 的分发脚本树、benchmark 源码、Node 可执行文件、根锁文件和直接依赖入口字节；manifest 另记录隔离源码快照及 Rust/Cargo 信息。依赖入口和锁文件不证明所有传递依赖字节都已锁定，报告须披露。环境记录 OS/kernel、CPU、文件系统、Node、Git HEAD、输入图形及随机种子；manifest 的源码快照哈希比 HEAD 更能标识可能含未提交改动的候选。应另外记录实际采样时段、机器竞争和环境异常。中断或守卫失败的运行不计入通过。

旧 CLI list/search 是文本，候选为 JSON；trace 两边都是 JSON，但排版也可能不同。输出字节数和 renderer 成本须明确披露，不能声称两边输出成本相同或将只读内核当完整 CLI。禁止清空系统缓存：新进程不等于冷文件缓存；不对 CPU、内存或纯 I/O／构图阶段做未经实测的结论。Windows 未实测不得由 Linux 外推。无统一加速 SLA，退化同样报告。
