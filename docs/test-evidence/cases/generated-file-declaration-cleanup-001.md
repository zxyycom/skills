### Case GENERATED-FILE-DECLARATION-CLEANUP-001: 声明树清理只移除已验证的过期文件

Tests:
- `test:741ea6d49049b8402eb8de2b1faf41b04ba874d734c5e5cfb30618701eaa8118`
- `test:eaa4ca0e26f8515f59e76638cf881944bef92207f4c33ecb3d5f914f99d7b4ed`

Tags:
- `repository-tooling`

Contract:
- 清理对象为当前声明闭包之外、带本生成器 header 的普通 `.d.mts` 文件及由清理而变空的受管子目录。未受管成员保持原样，由 `hasUnsupportedEntries` 标记并交给构建适配器阻断同步。

Proves:
- check 保留直属及嵌套过期声明；write 删除已验证的过期声明及清空的受管子目录，保留当前声明与未知成员，并返回不支持成员标记。
- 混合子目录中的手写声明、未知空目录和目录链接保持原样；链接指向的外部声明字节不变。
