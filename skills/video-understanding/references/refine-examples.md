# 校正 JSON 示例

先按[调用前准备](local-tools.md#调用前准备)设置 `$cli`，按[继续已有证据](local-evidence.md#继续已有证据)将本次证据 output 目录的完整绝对路径赋给 `$evidence`，并核对该目录的实际 `scopeId` 与材料 ID。下列示例中的 scope、ID、文字与时点须替换为本次证据 output 的实际值和本次核实内容，保存为获授权的绝对本地 JSON 路径 `$refinement` 再执行 `node "$cli" refine --output "$evidence" --file "$refinement"`。

## 选用一份字幕

source 的 material 是成功字幕 M，使用 material 而非 refs/text。

```json
{
  "scopeId": "<本次证据 output 的实际 scopeId>",
  "action": "create",
  "kind": "selection",
  "mode": "source",
  "material": "M0002",
  "purpose": "transcript",
  "reason": "需要原音听写，字幕材料另保留供比较",
  "verified": {"refs": ["T0003"], "note": "只回听核对了此条，其余仍是机器转录"}
}
```

## 同材料局部忠实修正／重分句

```json
{
  "scopeId": "<本次证据 output 的实际 scopeId>",
  "action": "create",
  "kind": "correction",
  "targets": ["T0003", "T0004"],
  "support": ["F0001"],
  "replacement": {"segments": [
    {"start": 10, "end": 11.2, "text": "第一段已核实原话"},
    {"start": 11.2, "end": 12, "text": "第二段已核实原话"},
    {"start": 12, "end": 13.5, "text": "第三段已核实原话"}
  ]},
  "reason": "回听后修正分句与时间，保留原始两条",
  "verified": {"refs": ["T0003", "T0004", "F0001"], "note": "只核实本组原话和该离散画面"}
}
```

## 另写译文／综合文案

```json
{
  "scopeId": "<本次证据 output 的实际 scopeId>",
  "action": "create",
  "kind": "selection",
  "mode": "authored",
  "refs": ["T0003", "F0001", "O0001"],
  "purpose": "narrative",
  "text": "依据已核实片段与画面形成的采用文案",
  "reason": "该任务需要综合文案而非原音字幕",
  "verified": {"refs": ["F0001", "O0001"], "note": "实际核对该帧文字；原音未回听"}
}
```

## 实际看过的单帧描述

support 仅可为 T/O，无字幕也可保存。

```json
{
  "scopeId": "<本次证据 output 的实际 scopeId>",
  "action": "create",
  "kind": "description",
  "refs": ["F0001"],
  "support": ["O0001"],
  "text": "该帧招牌显示已看清的文字",
  "reason": "保存此离散画面的核实描述",
  "verified": {"refs": ["F0001", "O0001"], "note": "实际打开该 PNG 核对文字；帧间状态未知"}
}
```

## 更新与撤销

已有 active S 时完整 update 同一 S：使用实际 id/expectedRevision，将 source 的 material 换为 authored 的 refs/text，kind 保持 selection。撤销仅提交以下字段；更新／撤销均使用本次读取的最新 revision：

```json
{
  "scopeId": "<本次证据 output 的实际 scopeId>",
  "action": "revoke",
  "id": "S0001",
  "expectedRevision": 1
}
```
