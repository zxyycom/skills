//! Facets are computed from the complete published snapshot, not the filtered page.
use super::trace::compare_text;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct TagFacet {
    pub tag: String,
    pub count: usize,
}
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct MonthFacet {
    pub month: String,
    pub count: usize,
}
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct TimeFacets {
    pub earliest: Option<String>,
    pub latest: Option<String>,
    pub months: Vec<MonthFacet>,
}
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Facets {
    pub record_count: usize,
    pub tags: Vec<TagFacet>,
    pub time: TimeFacets,
}
/// Inputs must come from a validated snapshot. Failure is propagated instead of
/// concealing an invalid stored timestamp as an empty facet.
pub fn build<'a>(
    entries: impl IntoIterator<Item = (&'a str, &'a [String])>,
) -> Result<Facets, String> {
    let mut count = 0;
    let mut tags = HashMap::<String, usize>::new();
    let mut months = HashMap::<String, usize>::new();
    let mut earliest: Option<i128> = None;
    let mut latest: Option<i128> = None;
    for (timestamp, record_tags) in entries {
        let parsed = OffsetDateTime::parse(timestamp, &Rfc3339)
            .map_err(|error| format!("invalid facet timestamp {timestamp}: {error}"))?;
        // JS Date stores integral milliseconds.
        let millis = parsed.unix_timestamp_nanos().div_euclid(1_000_000);
        let instant = OffsetDateTime::from_unix_timestamp_nanos(millis * 1_000_000)
            .map_err(|error| error.to_string())?;
        let month = format!("{:04}-{:02}", instant.year(), instant.month() as u8);
        *months.entry(month).or_default() += 1;
        for tag in record_tags.iter().collect::<HashSet<_>>() {
            *tags.entry(tag.clone()).or_default() += 1;
        }
        earliest = Some(earliest.map_or(millis, |old| old.min(millis)));
        latest = Some(latest.map_or(millis, |old| old.max(millis)));
        count += 1;
    }
    let mut tags: Vec<_> = tags
        .into_iter()
        .map(|(tag, count)| TagFacet { tag, count })
        .collect();
    tags.sort_by(|a, b| compare_text(&a.tag, &b.tag));
    let mut months: Vec<_> = months
        .into_iter()
        .map(|(month, count)| MonthFacet { month, count })
        .collect();
    months.sort_by(|a, b| compare_text(&a.month, &b.month));
    fn canonical(millis: i128) -> Result<String, String> {
        let date = OffsetDateTime::from_unix_timestamp_nanos(millis * 1_000_000)
            .map_err(|error| error.to_string())?;
        Ok(format!(
            "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
            date.year(),
            date.month() as u8,
            date.day(),
            date.hour(),
            date.minute(),
            date.second(),
            date.millisecond()
        ))
    }
    Ok(Facets {
        record_count: count,
        tags,
        time: TimeFacets {
            earliest: earliest.map(canonical).transpose()?,
            latest: latest.map(canonical).transpose()?,
            months,
        },
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn facets_use_utc_and_deduplicate_tags_per_record() {
        let tags = vec!["x".to_owned(), "x".to_owned()];
        let result = build([("2025-03-01T00:30:00+01:00", tags.as_slice())]).unwrap();
        assert_eq!(
            result.time.earliest.as_deref(),
            Some("2025-02-28T23:30:00.000Z")
        );
        assert_eq!(result.time.months[0].month, "2025-02");
        assert_eq!(result.tags[0].count, 1);
        assert!(build([("invalid", tags.as_slice())]).is_err());
    }
}
