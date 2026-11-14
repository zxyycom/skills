use super::{
    args::{HELP, parse_args},
    run,
};
use serde_json::{Value, json};
use std::io::{self, Write};

fn fail(message: impl ToString) -> Value {
    json!({"code":"resource-error","message":message.to_string(),"recovery":"检查记录、索引和路径后重新执行；必要时运行 sync-index"})
}

fn output(text: &str, committed: bool) -> bool {
    if let Err(error) = writeln!(io::stdout().lock(), "{text}") {
        let state = if committed {
            "index committed or unchanged; run check or sync-index to confirm"
        } else {
            "output unavailable"
        };
        let _ = writeln!(io::stderr().lock(), "{state}: {error}");
        false
    } else {
        true
    }
}

fn is_help(args: &[String]) -> bool {
    if args.is_empty()
        || matches!(
            args.first().map(String::as_str),
            Some("help" | "--help" | "-h")
        )
    {
        return true;
    }
    args.len() == 2
        && matches!(
            args[0].as_str(),
            "list" | "show" | "search" | "trace" | "check" | "sync-index"
        )
        && matches!(args[1].as_str(), "--help" | "-h")
}
fn status_output(text: &str, committed: bool) -> i32 {
    if output(text, committed) { 0 } else { 1 }
}
fn report_error(command: &str, message: String, json_mode: bool, code: i32) -> i32 {
    let error = fail(message);
    if json_mode {
        let text = json!({"version":1,"command":command,"ok":false,"error":error,"diagnostics":[]})
            .to_string();
        if !output(&text, false) {
            let _ = writeln!(io::stderr().lock(), "{}", error["message"]);
            return 1;
        }
    } else {
        let _ = writeln!(io::stderr().lock(), "{}", error["message"]);
    }
    code
}
fn execute(a: super::args::Args) -> i32 {
    match run(&a) {
        Ok(result) => {
            let text = if a.json {
                json!({"version":1,"command":a.command,"ok":true,"result":result,"diagnostics":[]})
                    .to_string()
            } else {
                serde_json::to_string_pretty(&result).unwrap_or_default()
            };
            status_output(&text, a.command == "sync-index")
        }
        Err(e) => report_error(&a.command, e, a.json, 1),
    }
}
pub fn main_entry() -> i32 {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if is_help(&args) {
        return status_output(HELP, false);
    }
    if args == ["--version"] {
        return status_output(
            &format!("resource-records {}", env!("CARGO_PKG_VERSION")),
            false,
        );
    }
    let options: Vec<_> = args.iter().take_while(|s| *s != "--").collect();
    let wants_json = options.iter().any(|s| s.as_str() == "--json");
    let command = options
        .iter()
        .find(|s| {
            matches!(
                s.as_str(),
                "list" | "show" | "search" | "trace" | "check" | "sync-index"
            )
        })
        .map(|s| (*s).clone())
        .unwrap_or_default();
    match parse_args(args) {
        Ok(a) => execute(a),
        Err(e) => report_error(&command, e, wants_json, 2),
    }
}
