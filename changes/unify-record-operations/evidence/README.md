# 1W 记录操作性能证据

本目录只拥有本Change的可复现性能方法、输入/源码证明与测量结果；任务状态由[任务清单](../tasks.md)维护。**最终有限结论见[最终报告](final-report.md)，不是两域全面提速或Gate通过声明。** IR严格与两域全集扫描明显慢于原版，保证成本、已消除机械重复及有限不确定性分别列出。

采样已结束，不再加测。归档为 153 个正常计时观察和 25 个分离计数观察；primary baseline 67，最终代表 42（最新快照直接实测 6、业务复用 36）。历史/交错观察不是额外最终场景；复用样本的旧 RSS/import 仍只证明其实际快照。最终稳定 Gate 尚未执行。

## 阅读路径

| 目的 | 材料 |
| --- | --- |
| 最终结论、保证变化、任务映射、未覆盖 | [final-report.md](final-report.md) |
| 全指标/argv/输入/后验/历史慢值与失败 | [final-results.json](final-results.json)；[摘要表](final-table.md) |
| 最终源码与业务复用边界 | [最终phase快照](final-phase-opt-manifest.json)、[phase复用证明](final-phase-reuse-proof.json)、[默认分支差异证明](final-runtime-reuse-proof.json) |
| 原版与输入 | [archive证明](source-manifest.json)、[主fixture](fixture-manifest.json)、[IR tag100变体](fixture-ir-content-100-manifest.json)、[原始65报告](baseline-report.md) |
| 中间阶段历史 | [0–3报告](after-0-3-report.md)、[mode修复阶段](mode-fixed-attempt-report.md)、[同read去重阶段](source-opt-attempt-report.md)、[严格prepare阶段](strict-opt-attempt-report.md)；这些报告的“待修/余项”只描述当时，不是当前状态 |
| 失败与最低区分证据 | [mode拒绝](final-attempt-mode-boundary.json)、[strict阶段计数/调用者](strict-opt-phase-findings.json)、[最初12计数](work-counts.json)；最终新计数含于final-results.json |
| 收口状态/方法hash | [remaining-plan.md](remaining-plan.md)、[sampling-manifest.json](sampling-manifest.json) |

## 固定负载与源码

- baseline为精确HEAD `5d6a73fb51ef1d9c2b0311e160cbd42a04576f42` archive，冻结 `/tmp/unify-record-operations-baseline/source`，不使用编辑中的工作树。
- 主fixture `/tmp/unify-record-operations-baseline/fixture-v3`，完整HEAD `9fdb438df1f4e33722cf6eb131983ba071930d75`。每域10000正式记录/9000合法稀疏边/2候选/固定短正文；IR资源与owner各1。DR前9000 archived、其余active，alignment交替；i>1000修订i−1000，目标合法归档。新建/既有mode按原生契约严格后验，不扩大0644白名单。
- IR content变体 `/tmp/unify-record-operations-baseline/fixture-ir-content-100`，HEAD `6736a70714f4358277773874de09c14e963e1206`。总存量仍10000，固定tag只选择末100；DR扫描10000。IR未过滤全命中budget2000拒绝留为边界，不计成功/回归。
- `generate.py`先按领域契约生成，再对冻结baseline公开CLI sync/check严格验收；只有成功才初始化独立Git。fixture无remote，屏蔽继承Git环境/全局配置及hook，普通测试提交；所有reset只作用于该私有fixture，不触碰真实Git。
- after来自实际dirty工作树tools/skills/scripts与根依赖配置，包含新helper/真实生成，不能git archive旧HEAD冒充。`freeze-source.py`验证before-current==copied==after-current逐路径bytes/hash/mode/symlink，然后仅移除复制品写位。各次快照新目录不覆盖旧证据。当前最终快照 `/tmp/unify-record-operations-final-phase-opt-20261023/source`；所有中间manifest见最终报告。
- node_modules链接宿主依赖只为源码测量；独立安装/分发证明由主线程维护，不由链接替代。

## 封套、计量与后验

`measure.py`每样本新Node进程、串行，与Gate/重型工作互斥。OS cache不清，reset/manifest读取会预热，不称冷缓存。

- API import后计时：DR固定公开`runDecisionRecordsCli` dispatcher（含解析/渲染）；IR固定公开typed API（JSON序列化计时外）。两域API不可横向比绝对值。API `process.cpuUsage`不含Git子进程；wall含等待。
- CLI真实Node分发入口launch→wait4，含启动/import/渲染；user/system是wait4 CPU。两入口分开，不把省外部验收计收益。
- maxRSS KiB为截至采集点生命周期高水位、含import；API于调用结束采集，IR后续JSON输出不计入该高水位采集点。stdout/stderr统计实际UTF8字节。业务复用不推导最新import/RSS等价，旧值保留实际snapshot。
- full/selected仅改末项title；metadata全命中窗口5，list窗口5/offset5；其余按固定代表。四sync热点各3，其他原样本和有限AB/BA全部保留，不追最快值、固定倍数或完整参数矩阵。
- 每次精确reset同HEAD并校验完整bytes/mode manifest，记录域digest；逐样本独立核对文件delta白名单、未选bytes/mode/entry、所选完整entry、身份/locator、sourceRevision fingerprint/membership、计数/边数、查询count/coverage/窗口。失败即停，不能算成功性能。
- 用户减少额外 check 的要求生效后，新增额外外部全量 check 为 0；被测 check 仍是两域各 1 个代表，逐样本精确输入和独立后验保持。已有域/fixture proof 按真实旧快照复用，不因更换 freeze 路径补测全量 check。历史检查 receipt 与观察点差异见最终报告。

## 可复现入口

- `generate.py`：合成合法fixture及独立Git输入；10k树不入仓库。
- `freeze-source.py`：三方冻结证明；`measure.py` + `api-worker.mjs`：正常封套、原样metrics、精确reset/后验。每样本完整实际inner argv在JSON，是执行命令权威。
- `instrument.py --phases`：只复制并修改受控/tmp的分发运行闭包，不改产品/真实生成。worker仅在`RECORD_PERF_COUNTS=1`包装具名函数与FS/handle计数；`RECORD_PERF_PHASES=1`增加已核对顺序marker。计数时间不混正常样本，flat与stage是同一批调用、不能相加，FS调用不等于物理IO。
- `run-phase-final.py --stage cli`保存最后已执行5个CLI固定清单；`collect-final.py`只汇合结果，不运行产品。比较脚本只保存限定源码diff/hash/默认分支复用解释。
- 旧`paired-round.py`、`run-final-stage.py`、`run-strict-final.py`仅重现其历史阶段方案，不代表当前允许追加的测量清单。当前有限窗口已结束，不再运行历史宽counts/check计划。

本目录是短期Change证据，不是产品API/长期benchmark/Gate测试。所有10k来源树、完整raw输出、插桩副本、失败现场与源码清单只留受控/tmp；各目录artifact-note说明保留与清理。Change结项时本目录随Change退出，不搬入历史调查resources或稳定docs。性能owner交付后停写，主线程完成报告窄审和最终Gate。
