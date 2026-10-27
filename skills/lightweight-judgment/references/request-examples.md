# 判断请求示例

本参考用于设计多题请求；输入校验与命令仍以 [CLI 操作契约](cli.md#json完整请求)为准。示例不证明服务实测效果或业务采用正确。

## 同一材料的独立双题

双题示例：比较两份共同适用的规范，分别判断是否冲突、是否各有独有要求。以下为虚构的完整材料，两题共享 state；可保存为 JSON 后通过 `json --file` 发送：

```json
{
  "state": {
    "scope": "两份规范当前均适用于同一项目的每次正式发布，没有例外条件。",
    "a": {"id": "A", "text": "发布前必须完成安全检查。版本号采用递增整数。"},
    "b": {"id": "B", "text": "发布前允许跳过安全检查。发布时必须附带变更说明。"}
  },
  "questions": {
    "conflict": {
      "type": "choice",
      "instructions": "依据 state.scope，比较 state.a.text 与 state.b.text 是否对同一行为提出互不相容的要求或许可；一方要求必做而另一方允许不做，也属于冲突。",
      "criteria": {
        "conflict": "共同适用时存在互不相容的要求或许可",
        "compatible": "材料足够，且共同适用时要求与许可相容",
        "insufficient": "正文或适用条件不足以确定是否相容"
      }
    },
    "distinct_requirements": {
      "type": "choice",
      "instructions": "只根据 state.a.text 与 state.b.text 判断：双方是否各自包含对方未覆盖的要求？有无独有要求与是否存在局部冲突分别判断。",
      "criteria": {
        "yes": "双方各有对方未覆盖的要求",
        "no": "至少一方的全部要求已被另一方覆盖",
        "insufficient": "正文不足以确定要求是否被覆盖"
      }
    }
  }
}
```

阅读预期（非服务实测）：`conflict=conflict` 且 `distinct_requirements=yes`。安全检查的要求与许可冲突，版本号和变更说明则各自独有；两种性质可以同时成立。两题均保留缺证出口，实际使用时核对正文与适用条件，再由 agent 复核原文形成建议；改写、合并或删除遵循原任务授权。
