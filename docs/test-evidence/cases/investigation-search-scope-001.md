### Case INVESTIGATION-SEARCH-SCOPE-001: search 排除非正式文件并只读回退

Tests:
- `test:c23ee38b05ce3eb37811c86c09504160a4aaa9004e574b65c34b912b7be6d73b`

Tags:
- `investigation-report`

Contract:
- Investigation search 只搜索正式报告 Markdown，排除 candidate、随附资源和派生索引；索引缺失时从合法正式来源构建只读投影而不写回索引。

Proves:
- 只存在于 candidate 或资源文件的词不返回任何报告。
- 删除派生索引后，正式 Markdown 的命中仍返回正式 Investigation ID、附带一个 warning，且不创建索引文件。
