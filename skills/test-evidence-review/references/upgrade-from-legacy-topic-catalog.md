# 从旧 Topic/`Entry:` 账本升级

仅当工作区仍使用本仓库上一代测试证据布局时读取：

- `docs/test-evidence/test-evidence-topics.json`（`schemaVersion: 1`）；
- 该文件列出的 `<topic-id>/<semantic-slug>.md` 单 Case 文件；
- 每个旧 Case 的 `Entry:`、`Contract:` 和 `Proves:`。

这是一次显式、可预演的升级，不是正常读取路径。当前 Case-only CLI 不读取旧
topic、`Entry:`、`Verification:`、单文件目录或项目配置。迁移器也不接受泛化
verification 目录、多个 Case 共用的 Markdown 或其他未列出的历史布局；先人工恢复为
上述受支持旧布局，或为该布局另行建立迁移方案，不能借正常查询兼容读取。

## 迁移前提和不变量

迁移器只转换仍能由当前项目实体快照解释的旧 Case：每一个 `Entry:` 必须精确匹配一个
真实实体的 locator。零匹配、多匹配或不可解释的 Entry 都会阻断，不能用旧字符串派生
或猜测 `Tests:` ID。一个旧 Case 的多个 Entry 可分别映射为多个实体，迁移将其去重后
写入同一 Case 的 `Tests:`；同一实体也可被多个 Case 引用，不要求反向闭合或所有快照
实体均被引用。迁移保留 Case ID、标题、Contract 与 Proves，把旧 topic 作为初始 tag，
并把每个 Case 写为 `cases/<lowercase-case-id>.md`。

迁移不扫描测试、不会替你判断新增、删除、拆分或合并后的测试意图。开始前先完成本次
测试与 Case 审查；不再成立的旧 Case 应由维护者明确处置，而不是由迁移器静默丢弃。

## 先预演，再写入

1. 停止写入旧账本，并保留其当前工作区状态供预演核对。不要手工建立 `cases/` 或复制旧
   索引；目标冲突会阻断迁移。
2. 用项目生产器生成一个尚不存在的快照文件，并从**同一项目输入边界独立计算或核验**
   `expected source`。快照输出的 `source` 只能用来比较二者是否一致；不得从待验证快照
   复制三个字段后作为自己的证明。当前仓库的项目生产器以其 source fingerprint owner
   独立计算该值。

   ```text
   bun run snapshot:test-evidence -- --output <new-snapshot.json>
   ```

3. 默认执行预演。将独立得到的 `projectId`、`scopeId` 与 `revision` 传给迁移命令；它只
   输出转换计划，不写 Case、不删除旧源。

   ```text
   bun run migrate:test-evidence -- --snapshot <new-snapshot.json> --expect-project <independently-derived-project-id> --expect-scope <independently-derived-scope-id> --expect-revision <independently-derived-revision>
   ```

4. 审核预演的新增与删除路径、Case ID、每个旧 Entry 的映射和预期 source。任何阻断、源
   漂移或目标冲突都要先解决后从新的快照重新预演；不要修改计划来绕过诊断。
5. 只有预演已通过、输入仍相同且确认写入范围后，才使用同一组参数追加 `--write`。

   ```text
   bun run migrate:test-evidence -- --snapshot <new-snapshot.json> --expect-project <independently-derived-project-id> --expect-scope <independently-derived-scope-id> --expect-revision <independently-derived-revision> --write
   ```

写入前会复验旧源和目标；它先发布新 Case 与派生索引，再移除已验证的旧 Case 与 topic
表。失败时只恢复仍可确认属于本次事务的原始字节；并发变化会保留现场并报告，绝不能
递归删除未知路径或手工清除报告中的现场。

## 写入后的验证

写入成功后，旧布局已不再是运行时输入。运行当前检查与项目覆盖检查，并只从新路径
查询：

```text
bun run test-evidence -- check --root <workspace-root>
bun run check:test-evidence-catalog
bun run test-evidence -- list --root <workspace-root>
bun run test-evidence -- show <case-id> --root <workspace-root>
```

`list` 仅报告派生索引快照；使用 `show` 核对一个具体 Case 的权威正文。若索引或当前性
诊断阻断，按诊断重新同步或修复新 Case，不要恢复旧 topic 目录作为 fallback。
