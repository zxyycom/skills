//! Validation of portable resource identifiers within an investigation owner.
use super::is_kebab;

pub fn valid_resource_id(value: &str) -> bool {
    let parts: Vec<_> = value.split('/').collect();
    parts.len() >= 2 && is_kebab(parts[0]) && parts.iter().all(|part| valid_component(part))
}

fn valid_component(part: &str) -> bool {
    if part.is_empty() || part.starts_with('.') || part.ends_with('.') || reserved_name(part) {
        return false;
    }
    valid_component_text(part)
}

fn identity_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || c == '〇' || ('一'..='鿿').contains(&c)
}

fn valid_component_text(part: &str) -> bool {
    let mut depth = 0;
    part.chars().any(identity_char)
        && part.chars().all(|c| {
            if c == '(' {
                depth += 1;
            } else if c == ')' {
                depth -= 1;
            }
            (0..=32).contains(&depth)
                && (identity_char(c) || "._-+@=()（）[]【】《》,!~'，。！、·：？".contains(c))
        })
        && depth == 0
}

fn reserved_name(part: &str) -> bool {
    let name = part.split('.').next().unwrap_or("");
    [
        "con", "prn", "aux", "nul", "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8",
        "com9", "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
    ]
    .iter()
    .any(|reserved| name.eq_ignore_ascii_case(reserved))
}
