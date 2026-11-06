//! Deterministic frontier evidence produced by a bounded trace.
use super::*;

pub(super) type FrontierMap = HashMap<(String, Direction, Reason), HashSet<String>>;

pub(super) fn add_frontier(
    frontiers: &mut FrontierMap,
    from: &str,
    direction: Direction,
    reason: Reason,
    ids: impl IntoIterator<Item = String>,
) {
    let ids: HashSet<_> = ids.into_iter().collect();
    if !ids.is_empty() {
        frontiers
            .entry((from.to_owned(), direction, reason))
            .or_default()
            .extend(ids);
    }
}
pub(super) struct FrontierReport {
    pub frontier: Vec<Frontier>,
    pub stopped_by: Vec<Reason>,
}
pub(super) fn finish_frontiers(frontiers: FrontierMap) -> FrontierReport {
    let mut frontier: Vec<_> = frontiers
        .into_iter()
        .map(|((from_id, direction, reason), ids)| {
            let mut next_ids: Vec<_> = ids.into_iter().collect();
            sort_ids(&mut next_ids);
            Frontier {
                from_id,
                direction,
                reason,
                next_ids,
            }
        })
        .collect();
    frontier.sort_by(|a, b| {
        compare_text(&a.from_id, &b.from_id)
            .then_with(|| direction_rank(a.direction).cmp(&direction_rank(b.direction)))
            .then_with(|| reason_rank(a.reason).cmp(&reason_rank(b.reason)))
    });
    let mut stopped_by = Vec::new();
    for reason in [Reason::Depth, Reason::MaxRecords] {
        if frontier.iter().any(|f| f.reason == reason) {
            stopped_by.push(reason);
        }
    }
    FrontierReport {
        frontier,
        stopped_by,
    }
}

fn direction_rank(value: Direction) -> u8 {
    match value {
        Direction::Predecessors => 0,
        Direction::Successors => 1,
    }
}
fn reason_rank(value: Reason) -> u8 {
    match value {
        Reason::Depth => 0,
        Reason::MaxRecords => 1,
    }
}
