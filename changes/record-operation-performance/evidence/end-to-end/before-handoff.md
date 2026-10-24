# 本轮真实CLI before交接

> 历史before时点交接；本轮after现已完成，当前结论见`report.md`。下文保留before时点事实，不作为继续执行baseline或重复采样的指令。

**13个实际CLI样本完成，计时quiet窗已结束；after未冻结、未执行。** 本轮before是精确产品HEAD `1adb98465a7972de3517bf5128a504504419affc`，不是旧报告计时；全部产品exit0，12个首次后验通过、1个harness权限预期错误经根批准对同次现场补后验通过。没有第二次rename，没有第14个样本，没有额外full check。明确计数：normalProductCommandCount=13、原始JSONL观察行=13、补充后验纠正记录=1；纠正记录不是新命令/新计时样本。

## 可核对入口

- `plan.md`：获准9场景、每版本13次真实Node分发CLI，after继续执行同清单，不混SDK。
- `results.jsonl`：逐次真实argv、source/input digest、wall/user/system/RSS、stdout/stderr byte/hash和完整后验；原始后验失败行保持原样。
- `summary-table.md`：13次before全部值，慢值保留；selected各3次，其余各1次，不冒称统计稳定。
- `audit.json`：实际运行 `collect.py --expect-before 13 --expect-after 0` 通过；raw哈希、跨重复同输入、完整source/dependencies闭包最终不变通过。
- `provenance-before.json`：源码、依赖、fixture摘要与完整manifest位置。source2436文件/11783782bytes，SHA `0c26652805152623a1eaeafb30c567b511206a9e7984aefdd1a5ebc25a39e0f8`；私有依赖10997文件/253961185bytes，SHA `30312346c53797807a1693188f52d767d0b83a406f6c4e2fd6dba60f08188ab9`。
- `help-before.json`：本轮7个实际分发CLI help均成功，参数token已核对。

## before观测（秒）

| 域 | check | selected三次 | full sync | rename | discard |
| --- | --- | --- | --- | --- | --- |
| DR | 18.505 | 35.701 / 36.459 / 35.796 | 35.681 | 59.387 | 未列入 |
| IR | 15.155 | 28.880 / 29.040 / 28.583 | 33.041 | 117.667 | 109.762 |

从进程launch至wait4退出计量，包含Node启动、分发wrapper/import、完整业务和输出。不是旧API封套，也不是reader微批次。source/fixture manifest核对、reset和独立后验在计时外；会预热OS cache。测量期间协调其他代理只读/编辑，不声称排除宿主所有活动。

## 后验与一次纠正

每个样本核对整个docs集合精确delta、未选bytes/mode/entry/revision、全index预期结构、完整来源指纹/ID/locator、metadata指纹与全部稀疏关系形状；两个被测readonly check兼作本轮合法性证据、全文件零改动。所有8个sync的整个index文本也精确等于只替换目标title和目标revision后的预期bytes。strict检查真实旧对象退出/新对象出现、正文和metadata、mode及未改资源；HEAD和staged内容不变。

IRrename产品exit0后，harness错误地要求目标0600，实际0664使初次后验失败。精确1adb `tools/investigation-report/src/rename-transaction-plan.ts:158` 明确 `mode: removal.before!.mode`，已有表示必须保持；0600是不存在对象的原生创建意图，不能强套于rename。根独立确认并批准纠正。

`posterior-correction-before-ir-rename-1.json` 绑定原始失败行canonical SHA、旧/新harness SHA、根批准与完整修正后验；旧harness留私有目录，原失败行/raw未覆盖。只补查保留现场，没有再次调用产品；表内117.667s就是原来同一个样本。`collect.py`显式读取纠正记录接纳，审计保留 originalPosteriorFailureCount=1，不隐藏失败。

## 下一轮恢复

1. 根明确最终实现、同步生成及独立关键边界审查通过后，再允许 `setup.py after`；它冻结稳定工作树tracked+untracked源码/生成闭包，并在before/copy/after内容一致且依赖配置未变时接纳。不可提前对live工作树计时。
2. 冻结后先 `measure.py --version after --stage help`；根协调quiet窗后按 `checks`、`sync`、`strict` 执行。初始before fixture HEAD和manifest已保存；harness只会重置有本轮ownership marker的私有fixture，不触碰旧目录或真实repo。当前私有fixture停留在最后IRdiscard已完成状态，属预期，不需手动恢复旧目录。
3. after被测check继续兼合法性证据，仍无extra full check；阶段/调用语义变化、selected范围收窄与worker同保证收益必须分列。before/after是相同精确输入逻辑配对，不是时间相邻交错。没有20x CLI承诺。
4. 完成after后 `collect.py --expect-before 13 --expect-after 13` 复核。后续原始失败也追加保存，不覆盖或悄悄重跑。

## 辅助物与边界

唯一私有目录 `/tmp/record-end-to-end-1adb9846-20261024/` 保存before源码archive、冻结依赖、独立clone fixture、完整manifests、13组raw stdout/stderr及纠正前harness，见其中artifact-note。旧 `/tmp/unify-record-operations-baseline/fixture-v3` 只读，从未reset/修改。本Change结项后可删除本轮精确私有目录；本目录小型脚本/证据随Change退出。不改正式产品/测试/索引、不安装依赖、不commit/push、不运行Gate。后验只证明观测结果，不能替代独立产品安全/故障正确性审查。
