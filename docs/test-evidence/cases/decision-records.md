# Decision Records

### Case DECISION-DOMAIN-CATALOG-001: 决策域目录验证 owner 与成员关系
Entry:
- `tools/decision-records/tests/decision-domain-catalog.test.ts > decision domain catalog validates ownership and domain membership`
- `bun test --test-name-pattern="^decision domain catalog validates ownership and domain membership$" ./tools/decision-records/tests/run.ts`
Contract:
- 决策域目录必须唯一声明 owner，并只接纳属于该域的决策。
Proves:
- owner 冲突和跨域成员会产生诊断，合法成员保持可查询。

### Case DECISION-CONFIGURED-DIRECTORIES-001: 决策目录支持相对与绝对配置
Entry:
- `tools/decision-records/tests/configured-decision-directory.test.ts > configured decision directories support relative and absolute paths`
- `bun test --test-name-pattern="^configured decision directories support relative and absolute paths$" ./tools/decision-records/tests/run.ts`
Contract:
- 决策根目录配置必须正确解析 workspace 相对路径和显式绝对路径。
Proves:
- 两种配置都定位同一类决策制品且不改变身份语义。

### Case DECISION-TYPE-PATH-001: 决策类型与路径保持身份不变量
Entry:
- `tools/decision-records/tests/type-path-invariants.test.ts > decision types and paths preserve identity and alignment invariants`
- `bun test --test-name-pattern="^decision types and paths preserve identity and alignment invariants$" ./tools/decision-records/tests/run.ts`
Contract:
- 决策 ID、类型、domain 与文件路径必须相互对齐。
Proves:
- 不匹配身份被拒绝，合法路径可稳定还原决策身份。

### Case DECISION-CANDIDATE-LIFECYCLE-001: 候选决策生命周期受控
Entry:
- `tools/decision-records/tests/candidate-lifecycle.test.ts > candidate lifecycle enforces create, activate, discard, and rollback rules`
- `bun test --test-name-pattern="^candidate lifecycle enforces create, activate, discard, and rollback rules$" ./tools/decision-records/tests/run.ts`
Contract:
- 候选决策的创建、激活、丢弃与回滚必须遵循状态转换规则。
Proves:
- 合法转换更新状态，非法转换不修改决策集合。

### Case DECISION-CANDIDATE-ONLY-001: 丢弃唯一候选仍保留域目录
Entry:
- `tools/decision-records/tests/candidate-lifecycle.test.ts > discarding the only candidate preserves the domain catalog`
- `bun test --test-name-pattern="^discarding the only candidate preserves the domain catalog$" ./tools/decision-records/tests/run.ts`
Contract:
- 决策域不应因最后一个候选被丢弃而失去目录定义。
Proves:
- 候选删除后 domain catalog 仍存在且有效。

### Case DECISION-STATE-SNAPSHOT-001: 状态快照与后续源变更隔离
Entry:
- `tools/decision-records/tests/state-snapshot.test.ts > state snapshots are isolated from later source mutations`
- `bun test --test-name-pattern="^state snapshots are isolated from later source mutations$" ./tools/decision-records/tests/run.ts`
Contract:
- 已返回的决策状态快照不得被后续源对象修改反向污染。
Proves:
- 修改原始对象后，既有快照内容保持不变。

### Case DECISION-ACTIVATION-ARCHIVE-001: 激活与归档保持内容和索引原子性
Entry:
- `tools/decision-records/tests/activation-archive.test.ts > activation and archive transitions preserve content and index atomicity`
- `bun test --test-name-pattern="^activation and archive transitions preserve content and index atomicity$" ./tools/decision-records/tests/run.ts`
Contract:
- 决策激活和归档必须同步更新内容位置与索引状态。
Proves:
- 成功转换后文件与索引一致，失败路径不会留下半完成状态。

### Case DECISION-QUERIES-TRACE-001: 决策查询、展示与追踪保持契约
Entry:
- `tools/decision-records/tests/queries.test.ts > decision queries, show, and trace preserve filter and index contracts`
- `bun test --test-name-pattern="^decision queries, show, and trace preserve filter and index contracts$" ./tools/decision-records/tests/run.ts`
Contract:
- 决策 query、show 和 trace 必须共享筛选与索引身份语义。
Proves:
- 各入口返回一致决策集合、关系和诊断。

### Case DECISION-INDEX-MAINTENANCE-001: 索引维护识别漂移并同步规范状态
Entry:
- `tools/decision-records/tests/index-maintenance.test.ts > index maintenance detects drift and synchronizes canonical decision states`
- `bun test --test-name-pattern="^index maintenance detects drift and synchronizes canonical decision states$" ./tools/decision-records/tests/run.ts`
Contract:
- 决策索引检查必须识别漂移，同步必须从规范源重建状态。
Proves:
- 漂移索引产生诊断，写入同步后再次检查通过。

### Case DECISION-GENERATED-ARTIFACTS-001: 决策生成制品公开 Schema 与 API
Entry:
- `tools/decision-records/tests/generated-artifacts.test.ts > generated decision artifacts expose schemas, APIs, and portable metadata`
- `bun test --test-name-pattern="^generated decision artifacts expose schemas, APIs, and portable metadata$" ./tools/decision-records/tests/run.ts`
Contract:
- 决策分发制品必须包含约定 Schema、API 和可移植来源元数据。
Proves:
- 生成脚本、声明及 source map 暴露完整公共契约。

### Case DECISION-EVOLUTION-RELATIONS-001: 决策演进验证关系与目标状态
Entry:
- `tools/decision-records/tests/evolution.test.ts > decision evolution validates relation semantics and target states`
- `bun test --test-name-pattern="^decision evolution validates relation semantics and target states$" ./tools/decision-records/tests/run.ts`
Contract:
- 决策演进关系必须匹配来源语义和允许的目标状态。
Proves:
- 非法关系或目标被拒绝，合法演进关系可解析。

### Case DECISION-EVOLVE-COMMAND-001: Evolve 原子归档来源并创建目标
Entry:
- `tools/decision-records/tests/evolution.test.ts > evolve command archives sources and creates the aligned target atomically`
- `bun test --test-name-pattern="^evolve command archives sources and creates the aligned target atomically$" ./tools/decision-records/tests/run.ts`
Contract:
- Evolve 命令必须在一次操作中归档来源决策并创建对齐目标。
Proves:
- 成功后来源与目标状态一致，失败时不会留下部分转换。

### Case DECISION-FIRST-ESTABLISHMENT-001: 首次建立创建决策域与当前索引
Entry:
- `tools/decision-records/tests/first-establishment.test.ts > first establishment creates a decision domain and current index`
- `bun test --test-name-pattern="^first establishment creates a decision domain and current index$" ./tools/decision-records/tests/run.ts`
Contract:
- 空 workspace 中首次建立决策必须创建 domain 定义和当前索引。
Proves:
- 新决策可立即被域目录和索引查询。
