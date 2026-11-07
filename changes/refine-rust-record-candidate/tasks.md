# Tasks

按 readiness、实现和验证顺序推进；仅在对应工作及证据完成后勾选。

## Readiness

- [ ] 0.1 实施前核对当前状态、普查定位、候选及相关领域 owner，确认两条行为不改变 TS 生产语义；如有实际 owner 冲突向主代理报告。
- [ ] 0.2 阅读测试设计、测试证据和项目测试边界，针对下列成功与失败路径确定 fixture、入口及 Case 影响；审查编码规范与生成边界。

## Implementation

- [ ] 1.1 修正两域 discard/publish 帮助与 DR selected 预检/执行失败的工作区相对索引路径，保留语法、诊断及写入事实；整体 cfg(unix) 限定 symlink 测试。
- [ ] 1.2 libc 转 Unix dev-dependency 并核对锁文件，保留 tempfile；复用 is_kebab 与 JsTrim，保持命名、原值 CR/LF、修剪后长度、排序及错误边界。
- [ ] 1.3 OPS-002 通过 Result 成功值传递验证结果；OPS-001 单次 prepare 复用基线，保留第二路径图验证、失败顺序和独立入口，预检与执行仍独立准备。
- [ ] 1.4 实现只读 show/content BOM 一致兼容，保留原文、指纹及 stale；正式 check/sync 仍严格。
- [ ] 1.5 实现 selected 索引 fallback 只读头定位及所选全文校验，保留头部身份、安全和重复所选 ID 诊断；复核所选重新读取的身份。
- [ ] 1.6 比较 AUTHOR-001 现有与显式枚举转换并记录取舍；不新增泛型层或改变字符串。审查全改动符合编码规范、无多余抽象。
- [ ] 1.7 完成受影响的针对性测试与必要 Case/索引维护；实现后将候选 protocol 的待实施提示改为实际状态，保持调查历史不变。

## Verification

- [ ] 2.1 测试两域 help 与解析正反例，DR 默认及自定义目录的预检和执行 selected 失败路径，Unix symlink 节点及非 Unix 条件编译；核对 JSON 诊断和索引路径。
- [ ] 2.2 测试 BOM 与非 BOM 的已索引来源 show/content、原文、指纹及 stale，严格 check/sync 拒绝 BOM；回退的缺失索引或移动来源、未选正文非法编码、所选正文无效、头编码、安全和重复所选身份。
- [ ] 2.3 测试 is_kebab 边界与路径错误、JsTrim 空白/BOM/原 CRLF/长度/排序、selected 投影成功失败及图验证；核对 prepare 选择、预检、无变化、写入、读取失败、graph 与 selector/review 失败顺序及独立准备。
- [ ] 2.4 在 Linux 运行 `bun run test:record-rust`（全 target 及 ignored）、Rust fmt 和 clippy、锁定 release 双二进制构建、`bun run smoke:record-rust`、`bun run test:record-delivery`，以及 `bun run check -- --scope record-rust`（含公共 quick）；记录实际命令、环境与结果。
- [ ] 2.5 对 Windows 目标进行编译检查并记录目标和结果；不得称交叉编译为 Windows 原生运行或扩大既有 CI 的 release build + smoke 承诺。
- [ ] 2.6 复核成功标准、测试证据/Case、协议与实现一致、生成和生产边界及实际验证限制；向主代理交接证据与剩余风险。
