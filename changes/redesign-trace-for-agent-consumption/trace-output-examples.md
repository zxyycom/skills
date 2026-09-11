# Trace 输出讨论材料

本文件保存 `redesign-trace-for-agent-consumption` 讨论中形成的示例代码块，用于回查设计来源。代码块按讨论原文保留，不参与实现或验收。

当前契约、成员不变量和输出通道以 [design.md](design.md) 为准。以下第一个 JSON 省略了部分 referenced entries，文本渲染片段也不是当前 JSON-only CLI 输出；它们只能说明讨论时关注的结构和事件语义。

## 索引切片 JSON

```json
{
  "anchorId": "A",
  "direction": "predecessors",
  "limits": {
    "depth": 5,
    "maxRecords": 50
  },
  "coverage": {
    "complete": false,
    "stoppedBy": ["depth"]
  },
  "traceIds": ["A", "B"],
  "contextIds": ["C", "D"],
  "frontier": [
    {
      "id": "B",
      "direction": "predecessors",
      "reason": "depth",
      "omittedDirectCount": 1
    }
  ],
  "entries": {
    "A": {
      "title": "方向 A",
      "status": "active",
      "alignment": "aligned",
      "createdAt": "2026-09-10T00:00:00Z",
      "purpose": "承接查询责任",
      "background": "原方向同时承担多个职责。",
      "decision": "拆出独立查询方向。",
      "tags": ["decision-records"],
      "relations": [
        {
          "type": "拆分",
          "target": "B",
          "summary": "承接查询责任"
        }
      ]
    },
    "C": {
      "title": "方向 C",
      "status": "active",
      "alignment": "aligned",
      "createdAt": "2026-09-10T00:00:01Z",
      "purpose": "承接存储责任",
      "background": "原方向同时承担多个职责。",
      "decision": "拆出独立存储方向。",
      "tags": ["decision-records"],
      "relations": [
        {
          "type": "拆分",
          "target": "B",
          "summary": "承接存储责任"
        }
      ]
    }
  }
}
```

## 深度参数

```bash
trace A --direction predecessors
# 等价于 --depth 5
```

```bash
trace A --direction predecessors --depth 2
trace A --direction predecessors --depth all
```

## 记录上限

```bash
trace A --direction both
# depth=5, maxRecords=50
```

## 拆分事件闭合

```text
A --拆分--> B
C --拆分--> B
D --拆分--> B
```

```text
TRACE anchor=[A] direction=predecessors depth=all complete=true records=4

L0 [B] archived/aligned 原有统一方向
  split-successors:
    * [A] trace   active/aligned 方向 A
        detail: "承接查询责任"
    ~ [C] context active/aligned 方向 C
        detail: "承接存储责任"
    ~ [D] context active/aligned 方向 D
        detail: missing

L1* [A] active/aligned 方向 A
  predecessors:
    拆分 [B] "承接查询责任"
```

## 原子事件阻断

```json
{
  "coverage": {
    "complete": false,
    "stoppedBy": ["max-records"]
  },
  "blockedEvent": {
    "kind": "split",
    "recordIds": ["B", "A", "C", "D"],
    "requiredMaxRecords": 52
  }
}
```

## 参数讨论示例

```text
trace <selector>
  --direction predecessors|successors|both
  [--depth <n|all>]          # 默认 5
  [--max-records <n>]        # 默认 50
```
