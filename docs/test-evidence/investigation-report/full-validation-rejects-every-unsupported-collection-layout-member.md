### Case INVESTIGATION-COLLECTION-LAYOUT-001: 完整校验拒绝调查集合中的非法成员

Entry:
- `tools/investigation-report/tests/parsing-directory.test.ts > full validation rejects every unsupported collection layout member`
- `bun test --test-name-pattern="^full validation rejects every unsupported collection layout member$" ./tools/investigation-report/tests/run.ts`

Contract:
- 完整校验必须检查整个调查集合布局：根目录只接受合法分类目录和保留成员，分类目录只接受直属、非符号链接且名称合法的 Markdown 主题；指定路径的局部校验只处理目标报告。

Proves:
- 根目录中的隐藏文件、普通文件和伪分类文件，大小写不合法的分类目录，以及分类目录中的嵌套目录、错误扩展名文件和符号链接主题都产生对应布局诊断。
- 同一集合按合法主题路径执行局部校验时不受其他非法布局成员影响并返回成功。
