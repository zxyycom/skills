# E 切面正确性复核

## 结论

**未发现正确性阻断，无必须修复项。** 本轮为独立静态审查，不将实施者的运行记录当作本轮实测；未运行测试、变异、安装、SSH/MCP、外部业务请求或跨平台验证。

审查对象为交接的 19 个测试／fixture 文件：MCPShell 7 个，Lightweight Judgment 7 个（含两个新文件），Novel Cards 3 个，Change Plan 2 个。只读必要行为实现和聚合接线；未审阅或改写其他会话的 DR／Index Runtime 产品改动。仅新增本报告。

## 关键正确性核对

| 对象 | 静态结论与依据 |
| --- | --- |
| MCPShell 同步交错 | `tools/mcpshell-workspace-bridge/src/runtime-scripts.ts` 的 put 路径先验证 parent、cd 到物理 parent、完成 cat，再调用 wc；最终 containment 与 commit 均在 wc 后。`tests/support.ts:99–125` 的同步替身在该阶段核物理 cwd、临时文件后交换链接／移动父目录，事件只在动作成功后写入，之后执行真实 wc。`runtime-containment.test.ts` 外层核事件、链接终态、完整 payload；move 还核移出和重建目录均空、source 不变。因此删除后台 poll 与两个 8 MiB 时间窗口没有丢失这两个受控交错的边界证据，不等于穷尽真实 SSH 竞态。 |
| MCPShell 其他补强 | SSH calls 在入口无条件写入；真实 Git 正例确认该观察器可工作，两个本地拒绝后完整 calls 文件为空。binary/empty 的 put/get 均有独立 crypto SHA、bytes 与真实输出 bytes；empty 不再仅凭成功。initializer 首次结果核完整 unrelated 前缀，二次核全结果幂等。默认不建 Git，仅真实 patch 和 manual localhost 显式启用；原 patch 的真实 Git 行为保留。 |
| LJ 图片与归位 | disabled-image 矩阵为四种配置提供健康 key getter（含 legacy），外层核 input/images=true 诊断、getter=0、fetch=0、attempts=0、无 DB；没有依靠缺凭据拒绝。dry-run scope／坏 URL 矩阵保留。三个 source 节点与原实现逐体对应，移入 `adapter-image-validation.test.ts` 后由 request wrapper 和 run 接入；public wrapper 仍消费保留的大 PNG 真实 Node leaf，PNG fixture 提取未改变构造。 |
| LJ 子进程与 server | `adapter-distribution.test.ts:112–167` 预挂 close Promise；error／abort／3s timeout 记录失败并 SIGKILL，close 后才结算和移除 deadline／abort listener。finally 仍终止未退出 child、等待 close，再 server.close＋closeAllConnections、清 fixture；正常／局部超时路径没有脱离等待的测试异步工作。保留 Node／loopback／raw 和 normalized 观察。该结论不声称本轮实测 OS 进程回收。config99／CLI100／默认15000 分别有独立预期；stats 名称收窄与实际诊断观察一致。 |
| Novel Cards | BOM 第三 writer 抛错前标记，外层核命中和 count≥3，并比较完整 Buffer；成功 snapshot 完整原文观察保留。new-id 名称仅承诺单次可用，不将一次结果冒充普遍唯一性。删除后重新读取真实 current.records=[] 再 selectCard，不再手写空集。10000 卡、20 MiB、100 层的精确边界及 wrapper 接线仍在，未缩规模或放宽预算。 |
| Change Plan | `support.ts:227–257` 在两种 root fixture 的共同 callback 范围内清空继承 GIT_*，禁 system/global config、hooks、commit/tag signing，覆盖初始化和被测 API／真实 CLI；trace 仅在隔离 env 上增加本地 GIT_TRACE。finally 删除范围内 GIT_* 并恢复宿主快照后清目录；当前串行 fixture 前提下未发现宿主 Git 写入路径。旧 baseline 为合法但不存在的 40hex，名字只承诺其不阻断刷新，结果核精确当前 HEAD，不再借巨大 argv 声称从未查询旧 distance。 |

## 未覆盖与交接

- 只检查当前改动及必要邻近边界，没有重做全部 E 原生节点普查或对每个错误模型运行变异；实施者所报正常／hostile Git／超时故障／重复交错通过，仍属于其交接证据。
- 原 WAL／锁／SIGKILL、真实 Git、Node 和 SSH patch 必要观察未因本次改动被删除；没有本轮动态预算、泄漏或跨平台结论。
- Case／index、长期文档和最终 Gate 是已知后续整合责任，本报告不据其尚未同步提出阻断，也不能代替最终验收。
