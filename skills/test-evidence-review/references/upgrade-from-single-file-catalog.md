# 从单文件或直属主题目录升级

仅当工作区仍使用以下任一旧模型时读取：

1. 单个 Markdown 保存全部 case。
2. 测试证据目录由根目录直属主题 Markdown 组成，一个文件保存多个 case。
3. 遗留 `.test-evidence.json` 仍指向上述位置。

当前工具只接受固定的 `docs/test-evidence` 受控 topic 根目录，不读取项目级配置，
也不提供双轨读取或自动迁移。升级是显式内容迁移；不会扫描测试源码、发现测试入口
或改变 case 粒度。

## 升级前盘点

1. 记录全部现有 case ID、标题、Entry、Contract 和 Proves，确认 ID 跨旧目录唯一。
2. 为每个 case 选择一个稳定测试责任 topic。单文件模型需要显式归类；直属主题
   文件可以沿用既有责任，但必须把它写入受控 topic 表。
3. 确定每个 topic 的 kebab-case ID 和一行描述；按 topic ID 二进制词法升序排列。
4. 保留旧源和旧索引，直到固定目录完成同步、检查和代表性查询。

## 准备固定目录

1. 如果 `docs/test-evidence` 尚未被旧目录占用，可以直接建立最终目录；如果旧模型
   已占用该路径，先在同级 `docs/test-evidence-next` 准备完整新目录。
2. 在新目录写入 `test-evidence-topics.json`：

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
5. 不复制旧索引。新索引必须由权威 Markdown 和 topic 表重新生成。

单文件中的多个 case 必须逐一拆成独立文件。直属主题 Markdown 也必须逐 case
拆分到对应 topic 目录；旧主题文件名本身不再是目录成员。

## 切换并验证

停止写入旧源。如果使用了暂存目录，先把占用 `docs/test-evidence` 的旧目录移动到
根目录之外的可恢复位置，再把完整暂存目录改名为 `docs/test-evidence`。删除遗留
`.test-evidence.json`；当前工具不读取该文件，也不接受 `--config`。

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
5. 结果中的 `sourcePath` 是根目录相对 `<topic>/<slug>.md`。
6. `check` 通过，且查询没有依赖旧源或旧索引。

验证通过后再删除旧单文件、直属主题文件、旧索引和暂存备份。不要同时维护两个
权威源，也不要增加兼容双读；如果切换必须与其他仓库改动原子完成，就让完整严格
检查在迁移落地前保持阻断。
