use super::*;

fn created_date(created: &str) -> Result<String, TxError> {
    let date = time::OffsetDateTime::parse(created, &time::format_description::well_known::Rfc3339)
        .map_err(|e| fail("date", e))?
        .to_offset(time::UtcOffset::UTC);
    Ok(format!(
        "{:02}{:02}{:02}",
        date.year() % 100,
        u8::from(date.month()),
        date.day()
    ))
}

fn resolved_id(target: &str, id: &str, created_at: Option<&str>) -> Result<String, TxError> {
    if domains::name_from_id(target) != target {
        return Ok(target.into());
    }
    if domains::name_from_id(id) != id {
        return Ok(format!("{}-{target}", &id[..6]));
    }
    let created = created_at.ok_or_else(|| {
        fail(
            "date-required",
            "legacy candidate needs a complete dated target",
        )
    })?;
    Ok(format!("{}-{target}", created_date(created)?))
}

fn expected_date(
    id: &str,
    created_at: Option<&str>,
    candidate: bool,
) -> Result<Option<String>, TxError> {
    if domains::name_from_id(id) != id {
        return Ok(Some(id[..6].into()));
    }
    if candidate {
        return Ok(None);
    }
    let created = created_at.ok_or_else(|| fail("date", "missing creation date"))?;
    Ok(Some(created_date(created)?))
}

pub(super) fn target_identity(
    target: &str,
    id: &str,
    created_at: Option<&str>,
    candidate: bool,
) -> Result<String, TxError> {
    let target = super::super::selector_name(target);
    if !domains::is_kebab(target) {
        return Err(fail("target-invalid", "target must be a valid ID or name"));
    }
    let target_id = resolved_id(target, id, created_at)?;
    if domains::name_from_id(&target_id) == target_id {
        return Err(fail("target-invalid", "target must have a valid date"));
    }
    if expected_date(id, created_at, candidate)?
        .as_ref()
        .is_some_and(|date| *date != target_id[..6])
    {
        return Err(fail(
            "date-mismatch",
            "target date must match the source date",
        ));
    }
    Ok(target_id)
}
