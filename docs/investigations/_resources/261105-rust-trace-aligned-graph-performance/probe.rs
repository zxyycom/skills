use decision_records_rust_experiment::{graph::validate_graph, index::Index};
use serde_json::{json, Value};

type GraphNode<'a> = (&'a str, &'a str, Vec<(&'a str, &'a str)>);

fn graph(nodes: &[GraphNode<'_>]) -> Index {
    let mut entries = serde_json::Map::new();
    for (id, status, edges) in nodes {
        let relations: Vec<Value> = edges
            .iter()
            .map(|(kind, target)| json!({"type": kind, "target": target}))
            .collect();
        entries.insert((*id).into(), json!({"name":id,"sourcePath":format!("{id}.md"),"title":"title","status":status,"alignment":"aligned","createdAt":"2026-01-01T00:00:00Z","purpose":"purpose","background":"background","decision":"decision","tags":["tag"],"relations":relations}));
    }
    serde_json::from_value(json!({"schemaVersion":4,"namespace":"decisions","definitionVersion":11,"metadata":{},"sourceRevision":{"metadata":"x","entries":{}},"entries":entries})).unwrap()
}


#[test]
fn probe() {
 use decision_records_rust_experiment::trace::{render_trace, TraceOptions};
 for n in [8,16,32,64] {
  let names: Vec<String> = (0..n).rev().map(|i| format!("n{i:02}")).collect();
  let mut nodes: Vec<GraphNode<'_>> = vec![("anchor", "archived", vec![])];
  nodes.extend(names.iter().map(|name| (name.as_str(), "active", vec![("修订", "anchor")])));
  let index = graph(&nodes);
  for budget in [1,3,65] { for json in [false,true] {
   let options=TraceOptions { direction:"successors".into(),depth:Some(1),max_records:budget,json };
   println!("CASE fanin={n} budget={budget} json={json}\n{}",render_trace(&index,"anchor",&options).unwrap());
  }}
 }
 let cases = [graph(&[("a","archived",vec![]),("b","active",vec![("拆分","a")]),("c","active",vec![("拆分","a")])]),
 graph(&[("a","archived",vec![]),("b","archived",vec![]),("c","active",vec![("归并","a"),("归并","b")])]),
 graph(&[("a","archived",vec![]),("b","archived",vec![]),("c","archived",vec![("重划","a"),("重划","b")]),("d","archived",vec![("重划","b")]),("e","active",vec![("重划","c"),("重划","d")]),("f","active",vec![("重划","d")])])];
 for (i,index) in cases.iter().enumerate() { for anchor in index.entries.keys() { for direction in ["predecessors","successors","both"] { for budget in [1,2,3,4,10] { for json in [false,true] {
 let opts=TraceOptions {direction:direction.into(),depth:Some(2),max_records:budget,json};
 println!("CASE complex={i} anchor={anchor} direction={direction} budget={budget} json={json}\n{}",render_trace(index,anchor,&opts).unwrap());
 }}}}}
}
