# 从 v1 或 v2 测试目录升级

仅当工作区仍使用以下任一旧模型时读取：

1. v1：配置 `schemaVersion: 1`，或 `catalogPath` 指向单个 Markdown。
2. v2：配置 `schemaVersion: 2`，且目录由根目录直属主题 Markdown 组成。

当前工具只接受 v3 受控 topic 根目录，不提供双轨读取或自动迁移。升级是显式内容
迁移；不会扫描测试源码、发现测试入口或改变 case 粒度。

## 升级前盘点

1. 记录全部现有 case ID、标题、Entry、Contract 和 Proves，确认 ID 跨旧目录唯一。
2. 为每个 case 选择一个稳定测试责任 topic。v1 没有物理主题时显式完成归类；v2
   可以沿用旧主题文件的责任，但必须把它写入受控 topic 表。
3. 确定每个 topic 的 kebab-case ID 和一行描述；按 topic ID 二进制词法升序排列。
4. 保留旧目录和旧索引，直到新目录完成同步、检查和代表性查询。

## 建立 v3 根目录

1. 建立新的测试证据根目录，例如 `docs/test-evidence-v3/`。如果 v2 旧目录位于
   `docs/test-evidence/cases/`，不要在仍保留旧 `cases/` 时直接把其父目录作为 v3
   根目录；先使用并列暂存根完成验证，或把旧目录移到新根之外的可恢复位置。
2. 在根目录写入 `test-evidence-topics.json`：

   ```json
   {
     "schemaVersion": 1,
     "topics": [
       {
         "id": "access-control",
         "description": "Authorization boundaries and role-dependent outcomes."
       }
     ]
   }
   ```

3. 把每个旧 case 原样放入一个 `<topic>/<slug>.md`。每个文件恰好包含一个 case，
   `<slug>` 使用 kebab-case；不得因拆文件修改 case ID、合并 case 或扩大测试入口
   粒度。
4. 已定义但暂时没有 case 的 topic 不创建目录；已经创建的 topic 目录不得为空。
5. 不复制旧索引。新索引必须由 v3 权威源重新生成。

v1 单文件中的多个 case 必须逐一拆成独立文件。v2 的每个直属主题 Markdown 也必须
逐 case 拆分到对应 topic 目录；旧主题文件名本身不再是目录成员。

## 切换配置并验证

将 `.test-evidence.json` 切换为 v3，并让 `catalogPath` 指向根目录：

```json
{
  "schemaVersion": 3,
  "catalogPath": "docs/test-evidence-v3",
  "indexPath": "docs/test-evidence-v3/test-evidence-index.json",
  "caseIdPattern": "^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){2,}-\\d{3}$"
}
```

然后依次执行：

```text
node scripts/test-evidence-catalog.mjs topics --root <workspace-root>
node scripts/test-evidence-catalog.mjs sync-index --write --root <workspace-root>
node scripts/test-evidence-catalog.mjs check --root <workspace-root>
node scripts/test-evidence-catalog.mjs list --topic <topic> --root <workspace-root>
node scripts/test-evidence-catalog.mjs show <case-id> --root <workspace-root>
```

至少核对：

1. `topics` 与受控 topic 表一致。
2. case 总数和全部 case ID 与升级前盘点一致。
3. `list --topic` 只返回对应目录中的 case。
4. `show` 展开的正文、Entry、Contract 和 Proves 未变。
5. 结果中的 `sourcePath` 是根目录相对 `<topic>/<slug>.md`。不要沿用 v2 索引中
   可能包含 `catalogPath` 的工作区相对源路径。
6. `check` 通过，且查询没有依赖旧源或旧索引。

验证通过后再删除旧单文件、v2 直属主题文件和旧索引；需要使用最终标准路径时，在
停止写入旧源后移动已验证根目录并更新配置，再重新同步和检查。不要同时维护两个
权威源，也不要增加兼容双读；如果切换必须与其他仓库改动原子完成，就让完整严格
检查在迁移落地前保持阻断。
