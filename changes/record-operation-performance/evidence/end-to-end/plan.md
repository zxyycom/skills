# 真实 CLI 有界 before/after 计划（执行前审定）

状态：计划已执行：before13 + after13 个正常CLI样本、完整后验、实体末验与小型归档均完成；两次quiet窗已结束。最终结论与边界见`report.md`，无额外full check或插桩。

## 精确来源与输入

- before固定产品HEAD `1adb98465a7972de3517bf5128a504504419affc`；`4c3e35c2`只有计划不算产品变化。通过Git archive冻结相关源码、两域实际分发入口/runtime、根依赖配置，随后按bytes/mode/symlink完整manifest验收。after复制稳定工作树的同样闭包（含新增未跟踪实现/生成文件），before/copy/after清单一致才接纳，不能指向继续变化的live源码。
- Node实际调用冻结的 `skills/decision-records/scripts/decision-records.ts` 与 `skills/investigation-report/scripts/check-investigations.ts`。正常进程从启动计时至退出，stdout/stderr写文件并计byte/hash；包含Node启动、分发wrapper、import、完整操作与CLI渲染，不混旧SDK计时。
- 运行依赖另复制到本轮私有目录并记录完整bytes/mode/symlink manifest，两source仅连到该冻结副本，不安装/修改宿主依赖。若最终manifest/lock发生变化，不沿用不兼容依赖；先停下来协调。源码测量复用已安装兼容依赖不等于独立安装验证。
- 输入从旧私有fixture的精确Git HEAD `9fdb438df1f4e33722cf6eb131983ba071930d75` 独立clone（no-hardlinks/no-checkout），只在本轮私有副本checkout/reset，移除副本origin；不修改旧目录。旧manifest仅用于恢复原mode和证明输入来源，旧check/计时不算本轮证明。副本无remote、禁止宿主Gitconfig/hooks。
- 每域10000正式、9000稀疏边、2候选；IR资源/owner各1。共20007文件、19196017 bytes，旧docs manifest摘要 `cf5d8c03134ad49e5b5535fcae0bf89f64958974df8367e29d467a93f4f8b7f5`。读新副本Git对象、bytes、mode后再确认，不先假定复制成功。

## 固定清单与次数

下列参数分别前接 `node <冻结分发入口>`，后接 `--root <同一私有fixture绝对路径>`。除源码入口路径外，before/after argv逐字相同。禁止全命令×flags与10W扩展。

| 域 | 命令参数 | 每版本次数 | 输入差异 | 主要解读 |
| --- | --- | --- | --- | --- |
| DR | `check` | 1 | 原始合法HEAD | 同保证读取/扫描代表，兼本轮合法性证据 |
| IR | `check` | 1 | 原始合法HEAD | 同保证读取/扫描代表，兼本轮合法性证据 |
| DR | `sync-index --select 261001-record-10000` | 3 | 只改末项title | selected范围收窄 + 机械实现，不能称纯worker收益 |
| IR | `sync-index --select 261001-record-10000` | 3 | 同上 | 同上；CLI执行preflight变化若适用另列 |
| DR | `sync-index` | 1 | 同上 | 全来源读取同保证代表 |
| IR | `sync-index` | 1 | 同上 | 全来源读取；若CLI少一次preflight，必须独立列入 |
| DR | `rename 261001-record-10000 261001-renamed-record --rename-recorded-decision` | 1 | 未改原始HEAD，真实改名 | 完整严格事务，昂贵baseline只取1次 |
| IR | `rename 261001-record-10000 261001-renamed-record --rename-recorded-report` | 1 | 同上 | worker与执行preflight变化混合，不做单因果归因 |
| IR | `discard 261001-record-10000 --delete-recorded` | 1 | 同上，目标无incoming/自有资源 | 同上，真实删除 |

每版本13次、合计26次；两个被测readonly check各在该版本首批执行，失败立即保存现场/退出，不继续拿非法输入计成功性能。正常观察与任何插桩分开。所有失败、慢值、实际输入与raw输出保留，追加而不覆盖。

## 时间与执行窗口

预算估算不是结果：baseline约10–15分钟，after约2–5分钟，具体受整CLI/图与安全阶段成本影响；不把先前读取微批次约20x当CLI承诺。可拆两个baseline quiet窗：check+selected+full约5–8分钟；三个strict约5–7分钟。每个已开始样本完整收尾，不因估算时限强杀。若显著超预算，先汇报再缩窄未开始的重复，不删除已采数据。只有根明确协调其他任务暂停重型测试/typecheck/Gate后开始。

after未稳定前只准备freeze/harness。若baseline先跑，pair表示同一精确输入逻辑配对，不伪称时间相邻/交错。若两版均已冻结再跑，则selected三对采用B→A、A→B、B→A，其他各一次按域交错。OS cache不清、reset/manifest会预热，声明warm条件；不能保证宿主无其他后台活动。

## 独立后验与额外check界限

每次在计时前只重置本轮标记的私有副本，核对完整docs输入bytes/mode/membership及HEAD，sync场景只替换末项title一次。计时后独立Python检查：

1. 全docs delta白名单、无残留lock/temp/未知成员；跨域与未选文件bytes/mode不变，HEAD与Git staged内容未被CLI改变（不承诺index二进制stat缓存字节不变）。
2. 正式index所有entries/sourceRevision membership、ID↔sourcePath、每来源实际bytes的独立v2指纹；metadata指纹、完整未选entry/revision不变。full/selected只改变末项title及对应revision，完整index文本预期通过原JSON格式替换比对（若合法renderer表示改变，明确降为结构对照而非掩盖）。
3. check必须全文件零改动。rename检查旧ID/旧路径退出、新ID/name/locator、非目标entry关系和bytes不变、目标metadata正文表示及mode符合原有合同。discard检查恰少1正式、恰少1关系、旧对象退出，其他entry/revision/资源不变。
4. IR资源owner/路径/bytes/mode不变；DR状态/归档位置与对齐统计不变（删除场景未测DR）。逐样本完整数量与稀疏关系形状独立验证，不调用产品解析器充当自身证明。
5. fresh/readback义务由产品操作本身及独立正确性审查验证；此后验只证明观察到的最终状态，不声称证明所有竞态。无额外外部full check；两个被测check不算“没有跑过check”。

## 收益归因与计数提案

最终表至少拆：selected产品观察范围变化、IR执行少一次预检的阶段变化、同读取合同执行模型变化。full sync/readonly check提供同来源保证代表，但IR若同时减少预检，不能仅凭端到端差值隔离worker。原reader微批次是机制佐证，不替代本轮CLI before。

根已明确本轮**不新增插桩对照**。阶段复用由实现代理已有精确native证据与静态调用审查承接，明确不是本轮性能阶段计数；不为归因追加1k初始化、10k全矩阵或更换正常计时入口。端到端仅报告真实混合收益，不能把无法隔离的差值强行分摊给worker。

## 产物归宿

本目录只留本轮小型plan/scripts/results/provenance/report，随Change结项删除；源码、依赖、fixture及raw stdout/stderr留唯一私有 `/tmp/record-end-to-end-1adb9846-20261024/`，以artifact-note说明消费者、保留原因和精确清理边界。不改正式产品、生成、测试或索引；不在真实仓库commit/push。
