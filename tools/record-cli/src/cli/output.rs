pub(super) fn emit_success<T: serde::Serialize>(
    command: &str,
    json: bool,
    trace: bool,
    value: &T,
    warnings: &[String],
) -> i32 {
    for warning in warnings {
        eprintln!("{warning}");
    }
    // Serialize the original DTO rather than serde_json::Value: previews can
    // legitimately contain JSON-escaped unpaired UTF-16 surrogates.
    let output = if json && !trace {
        serde_json::to_string(&crate::protocol::Success {
            version: 2,
            command,
            ok: true,
            result: value,
            diagnostics: Vec::new(),
        })
    } else if json {
        serde_json::to_string(value)
    } else {
        serde_json::to_string_pretty(value)
    };
    match output {
        Ok(output) => {
            println!("{output}");
            0
        }
        Err(error) => print_error(
            command,
            json,
            crate::protocol::CommandError::new("serialization-error", error.to_string()),
            1,
        ),
    }
}

pub(super) fn transaction_error(
    error: crate::transaction::TxError,
) -> crate::protocol::CommandError {
    let mut output = crate::protocol::CommandError::new(error.code, error.message);
    output.diagnostics = error.diagnostics;
    output
}

pub(super) fn print_transaction_error(
    command: &str,
    json: bool,
    error: crate::transaction::TxError,
) -> i32 {
    print_error(command, json, transaction_error(error), 1)
}

pub(super) fn print_argument_error(command: &str, json: bool, error: super::ArgumentError) -> i32 {
    print_error(
        command,
        json,
        crate::protocol::CommandError::new("invalid-arguments", error.to_string()),
        2,
    )
}

pub(super) fn print_error(
    command: &str,
    json: bool,
    mut error: crate::protocol::CommandError,
    exit: i32,
) -> i32 {
    if json {
        let diagnostics = error.diagnostics.clone();
        let partial = match error.partial.take() {
            Some(text) => match serde_json::value::RawValue::from_string(*text) {
                Ok(value) => Some(value),
                Err(serialization) => {
                    eprintln!("invalid partial JSON: {serialization}");
                    return 1;
                }
            },
            None => None,
        };
        let envelope = crate::protocol::Failure {
            version: 2,
            command,
            ok: false,
            error,
            diagnostics,
            result: partial,
        };
        match serde_json::to_string(&envelope) {
            Ok(value) => println!("{value}"),
            Err(serialization) => {
                eprintln!("failed to serialize error: {serialization}");
                return 1;
            }
        }
    } else {
        eprintln!("{error}");
        if let Some(partial) = error.partial {
            eprintln!("{partial}");
        }
    }
    exit
}
