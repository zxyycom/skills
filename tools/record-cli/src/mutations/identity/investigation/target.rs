use super::*;

pub(super) fn target_identity(target: &str, formed_at: &str) -> Result<String, TxError> {
    let t = selector_name(target);
    if !domains::is_kebab(t) {
        return Err(fail("target-invalid", "invalid target"));
    }
    let timestamp =
        time::OffsetDateTime::parse(formed_at, &time::format_description::well_known::Rfc3339)
            .map_err(|e| fail("date", e))?
            .to_offset(time::UtcOffset::UTC);
    let date = format!(
        "{:02}{:02}{:02}",
        timestamp.year().rem_euclid(100),
        timestamp.month() as u8,
        timestamp.day()
    );
    let target_id = if domains::name_from_id(t) != t {
        t.to_string()
    } else {
        format!("{date}-{t}")
    };
    if domains::name_from_id(&target_id) == target_id || target_id[..6] != date {
        return Err(fail(
            "date-mismatch",
            "target date must match formedAt UTC date",
        ));
    }
    Ok(target_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn investigation_rename_target_uses_formed_at_utc_date() {
        let formed = "2026-11-07T00:30:00+02:00";
        assert_eq!(target_identity("new", formed).unwrap(), "261106-new");
        assert_eq!(
            target_identity("261106-new.MD", formed).unwrap(),
            "261106-new"
        );
        assert_eq!(
            target_identity("261107-new", formed).unwrap_err().code,
            "date-mismatch"
        );
    }
}
