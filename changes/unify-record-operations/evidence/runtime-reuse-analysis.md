# 0–3 → 当前最终候选：只读运行闭包复用分析

> 历史冻结阶段材料：待修/余项描述仅指当时；当前结论、已关闭问题与复用边界见 [final-report.md](final-report.md)，不据本阶段状态追加测量。

这是等待最终 Gate 的只读分析，**不是最终冻结，也没有新性能样本**。当前 source 后续若再变，须核对本分析绑定的 hash。源码通过 CodeGraph 查询优先定位；未索引的新模块及冻结快照以限定路径 diff 补充。没有读取或执行历史调查 resources。

## 方法与证据

- runtime-reuse-source-comparison.json 比较五个实际运行组件 src 共387文件；95个来源文本不同/增删，5个改动经 Bun1.4.2 TS→JS、去注释/空白后输出相同。compare-runtime-source.mjs 只转换文本，不 import/执行产品，不是计时。
- 规范化 JS 相同是类型/注释/格式排除证据，不把 JS 不同自动认作语义不同或相同。runtime-reuse-operation-proof.json 记录操作路径上完全不变文件和关键函数区间 hash，以及 pre-mode attempt→当前的实际改动。
- 根 package.json/pnpm-lock.yaml 与0–3逐字节相同；不据此宣称整棵 node_modules 内容从未改变。后续冻结复用同宿主依赖，只是源码测量，不代替独立分发证明。
- API timer 在 import 后开始；DR dispatcher 的 createCliProgram/参数解析/渲染仍在 timer 内。真实 CLI 含整个 import/启动/渲染。**API maxRSS 是进程生命周期高水位，也包含 import；业务分支等价不证明最终 import 高水位等价**，旧值保留阶段标签，不加说明地提升为最终内存值。

## 结论：应补测与可复用

| 操作/部分 | 0–3至当前变化 | 后续最小处理 |
| --- | --- | --- |
| 两域full/selected sync（0–3共12） | 真实执行变化：共同 storage-sync persisted read 从 readFile/decode 改 readBaselineSource 安全handle；DR scan来源/初次index改安全readRecordText、目录canonical、首次读取失败handoff；IR layout来源改安全readRecordText。不是只改readonly | 四热点组各3最终正常样本（最多12）。DRselected疑慢AB/BA仍是独立诊断，不冒充三次；两域full/selected需有限最终counts解释工作量，不能直接把旧stage提升为最终保证 |
| DR无关系list/metadata/content/show、关系list | query owner、所选safe-read、snapshot、shared text search、projection/graph与相应成功路径保持；prepared.ts仅类型；baseline reader新error.code只在非regular文件失败分支。decision-query-records只更正失败outcome，cli-program-queries只改check help注册文本 | 业务wall/CPU/输出/工作量的阶段证据可复用，不要求全查询重跑。DRcontent、metadata仍按原慢值有限AB/BA补证；CLI setup/string注册的细小差异由最终少数CLI/dispatcher代表覆盖，不声称全部入口字节完全一致 |
| IR list/关系list/show | query-index/query-report/relation-context与共同query/source未变。investigation-state-index模块的改动在check函数；loadInvestigationQueryIndex函数区间逐字节相同 | 业务阶段语义证据可复用，不重跑三个正常代表。最终import/启动/RSS限定同上 |
| IR metadata/content | query-search-selection移除4单用包装并合并selector/filter事实；normal无关系路径仍同一query.states→relation-map predicate、精确窗口/count/coverage，但存在真实回调/函数调用形态变化，不是纯readonly | metadata是疑慢组，有限AB/BA复核；content合法tag100变体补1最终正常API代表，保留0–3样本。无需全部关系/flags×双入口矩阵重跑 |
| DR候选new/readiness | known-formal skip/archive身份核对已修；new还改共同事务fresh/readback及creation-mode语义 | 0–3慢值只留问题证据，不能复用为最终；最终候选正常/有限counts确认，不以小例冒充1W |
| IR new | 共同事务、实际target/index guards、写后验收和mode/native creation路径变化 | 补1最终正常代表；pre-mode attempt的2.125s不直接作为最终。必要时加一个候选counts解释，不能未经证据称安全成本或noise |
| publish/IR两候选批、set-relations、rename/discard/check | 0–3尚无这些after；共同snapshot/journal、事务fresh/verify、G2首次采集、safe read等均为实改 | 按已定11个正常API代表、少数阶段counts后测。纯签名改动不能抵销真实改动 |

## 可排除的纯类型/文档或无用参数子改动

本次运行文本规范化完全相同的5个文件：

- decision-candidate-readiness.ts：显式返回型、readonly类型、as const消除；返回值常量/分支不变。
- scan-contracts.ts、types.ts：仅SourceFile失败标记/准备context的类型字段，类型本身无运行值；**字段的运行生产/消费在scan-collection/sync实改中另算，不能一并抹掉**。
- index-runtime/prepared.ts：Readonly签名替换，实际准备/消费函数体未变。
- rename-preparation-source.ts：RenameSource→Pick只约束签名，helper执行不变；整个rename事务仍实改、仍测。

稳定README/owner文档不被运行入口加载；不因其文字改动重测正常业务。CLI help/description字符串是运行时命令注册数据，不能简单称仓库文档；其无关命令help改动不扩大业务验收保证，但最终启动代表仍需独立测。

scanOptions无用参数删除仅是后期4–6重组内的局部整理；**0–3旧decision-transaction实际使用scanOptions重扫来源**。因此0–3→最终整个事务差异不能标成“noop参数删除”而免测。IR四包装合并也是真实JS形态优化，不归为type-only；其返回事实/条件顺序可审，不代表成本数学上零差异。

## pre-mode attempt的三个成功观察

- DR readiness、IR readiness：pre-mode→当前差异集中在事务写/permissions/journal及发布适配；两者只读准备、所选来源/直接依赖与索引load计算路径未变。原正常wall/CPU与后验可作为两个只读路径的保留证据；当前仍需按最终目标做必要1W候选计数，旧进程maxRSS不冒充最终import高水位。
- IR new：candidate-create-transaction从createMode（精确模式）改为creationMode（native语义），共同writer新增权限验证和实际handle mode身份携带，不以“实际都0600”推导成本/行为完全相同，补最终代表。
- DR new：实际0664→0644失败样本未获批准，永不计正常成功或收益。当前修复后需新source、新正常样本；原现场不覆盖。

## 正式窗口内执行边界

先冻结最终实际分发闭包并核对此分析来源hash，再候选确认、疑慢有限AB/BA，见可复现机械回退即停相关组交owner。真正source安全强化/G2保证改变单列成本，不与机械复用混称无损收益。有效阶段证据保留而不无限重测；尚无法稳定区分的微幅变化报告不确定，不擅自归为noise。
