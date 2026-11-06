//! Breadth-first admission and frontier accounting for one trace.
use super::frontier::{FrontierMap, FrontierReport, add_frontier, finish_frontiers};
use super::*;

fn compare_ids(a: &[String], b: &[String]) -> Ordering {
    for (x, y) in a.iter().zip(b) {
        let c = compare_text(x, y);
        if c != Ordering::Equal {
            return c;
        }
    }
    a.len().cmp(&b.len())
}
fn normalized(units: Vec<Unit>) -> Vec<Unit> {
    let mut result: Vec<Unit> = Vec::new();
    let mut positions = HashMap::new();
    for mut unit in units {
        sort_ids(&mut unit.trace_ids);
        unit.trace_ids.dedup();
        let key = Arc::as_ptr(&unit.group);
        if let Some(i) = positions.get(&key) {
            let existing: &mut Unit = &mut result[*i];
            existing.trace_ids.extend(unit.trace_ids);
            sort_ids(&mut existing.trace_ids);
            existing.trace_ids.dedup();
        } else {
            positions.insert(key, result.len());
            result.push(unit);
        }
    }
    result.sort_by(|a, b| {
        compare_ids(&a.trace_ids, &b.trace_ids)
            .then(a.group.kind.cmp(&b.group.kind))
            .then_with(|| compare_ids(&a.group.record_ids, &b.group.record_ids))
    });
    result
}
fn directions(request: RequestedDirection) -> &'static [Direction] {
    match request {
        RequestedDirection::Both => &[Direction::Predecessors, Direction::Successors],
        RequestedDirection::Predecessors => &[Direction::Predecessors],
        RequestedDirection::Successors => &[Direction::Successors],
    }
}
/// Traversal bounds supplied by the validated query boundary.
#[derive(Clone, Copy)]
pub struct SelectionLimits {
    pub depth: Option<usize>,
    pub max_records: usize,
}
/// `units` returns complete domain events; `neighbors` returns valid direct graph
/// neighbors, even when an event cannot fit. Both must use one validated snapshot.
/// The domain adapter interns each equivalent event group once, with unique,
/// UTF-16-sorted members; each trace target must belong to that group. Sharing
/// `Arc` identity allows event membership to be admitted once per selection.
pub fn select<U, N>(
    anchor: &str,
    direction: RequestedDirection,
    limits: SelectionLimits,
    mut units: U,
    mut neighbors: N,
) -> Selection
where
    U: FnMut(&str, Direction) -> Vec<Unit>,
    N: FnMut(&str, Direction) -> Vec<String>,
{
    assert!(
        limits.max_records > 0,
        "max_records is validated by the command boundary"
    );
    let mut walk = Traversal::new(anchor, direction, limits);
    let mut layer = vec![anchor.to_owned()];
    let mut level = 0usize;
    while !layer.is_empty() {
        sort_ids(&mut layer);
        let Some(next) = walk.visit_layer(&layer, level, &mut units, &mut neighbors) else {
            break;
        };
        layer = next.into_iter().collect();
        level += 1;
    }
    walk.finish()
}
// Position in the current BFS layer; it determines all remaining frontier work.
struct LayerCursor<'a> {
    from: &'a str,
    direction: Direction,
    directions_left: &'a [Direction],
    layer_left: &'a [String],
    directions: &'a [Direction],
    level: usize,
}
// The unvisited part of the breadth-first layer when an event cannot fit.
struct Remainder<'a> {
    cursor: LayerCursor<'a>,
    units: &'a [Unit],
    next: &'a HashSet<String>,
}

struct Traversal {
    direction: RequestedDirection,
    limits: SelectionLimits,
    trace: HashSet<String>,
    context: HashSet<String>,
    seen_depth: HashMap<String, usize>,
    frontiers: FrontierMap,
    blocked_event: Option<BlockedEvent>,
    admitted_groups: HashMap<*const EventGroup, Arc<EventGroup>>,
}
impl Traversal {
    fn new(anchor: &str, direction: RequestedDirection, limits: SelectionLimits) -> Self {
        Self {
            direction,
            limits,
            trace: HashSet::from([anchor.to_owned()]),
            context: HashSet::new(),
            seen_depth: HashMap::from([(anchor.to_owned(), 0)]),
            frontiers: HashMap::new(),
            blocked_event: None,
            admitted_groups: HashMap::new(),
        }
    }
    fn visit_layer<U, N>(
        &mut self,
        layer: &[String],
        level: usize,
        units: &mut U,
        neighbors: &mut N,
    ) -> Option<HashSet<String>>
    where
        U: FnMut(&str, Direction) -> Vec<Unit>,
        N: FnMut(&str, Direction) -> Vec<String>,
    {
        let mut next: HashSet<String> = HashSet::new();
        for (i, id) in layer.iter().enumerate() {
            if self.seen_depth.get(id) != Some(&level) {
                continue;
            }
            let dirs = directions(self.direction);
            for (di, dir) in dirs.iter().copied().enumerate() {
                let cursor = LayerCursor {
                    from: id,
                    direction: dir,
                    directions_left: &dirs[di + 1..],
                    layer_left: &layer[i + 1..],
                    directions: dirs,
                    level,
                };
                if !self.visit_direction(cursor, &mut next, units, neighbors) {
                    return None;
                }
            }
        }
        Some(next)
    }

    fn visit_direction<U, N>(
        &mut self,
        cursor: LayerCursor<'_>,
        next: &mut HashSet<String>,
        units: &mut U,
        neighbors: &mut N,
    ) -> bool
    where
        U: FnMut(&str, Direction) -> Vec<Unit>,
        N: FnMut(&str, Direction) -> Vec<String>,
    {
        if self.limits.depth.is_some_and(|limit| cursor.level >= limit) {
            add_frontier(
                &mut self.frontiers,
                cursor.from,
                cursor.direction,
                Reason::Depth,
                neighbors(cursor.from, cursor.direction),
            );
            return true;
        }
        let ordered = normalized(units(cursor.from, cursor.direction));
        for (ui, unit) in ordered.iter().enumerate() {
            let required = self.required_records(unit);
            if required > self.limits.max_records {
                self.record_remainder(
                    unit,
                    required,
                    Remainder {
                        cursor,
                        units: &ordered[ui..],
                        next,
                    },
                    neighbors,
                );
                return false;
            }
            self.admit(unit, cursor.level + 1, next);
        }
        true
    }

    fn record_remainder<N>(
        &mut self,
        unit: &Unit,
        required: usize,
        rest: Remainder<'_>,
        neighbors: &mut N,
    ) where
        N: FnMut(&str, Direction) -> Vec<String>,
    {
        if unit.group.kind != Kind::Ordinary {
            self.blocked_event = Some(BlockedEvent {
                kind: unit.group.kind,
                record_ids: unit.group.record_ids.clone(),
                required_max_records: required,
            });
        }
        let next_reason = if self
            .limits
            .depth
            .is_some_and(|limit| rest.cursor.level + 1 >= limit)
        {
            Reason::Depth
        } else {
            Reason::MaxRecords
        };
        add_frontier(
            &mut self.frontiers,
            rest.cursor.from,
            rest.cursor.direction,
            Reason::MaxRecords,
            rest.units
                .iter()
                .flat_map(|unit| unit.trace_ids.iter().cloned()),
        );
        self.record_neighbors(
            std::iter::once(rest.cursor.from),
            rest.cursor.directions_left,
            Reason::MaxRecords,
            neighbors,
        );
        self.record_neighbors(
            rest.cursor.layer_left.iter().map(String::as_str),
            rest.cursor.directions,
            Reason::MaxRecords,
            neighbors,
        );
        self.record_neighbors(
            rest.next.iter().map(String::as_str),
            rest.cursor.directions,
            next_reason,
            neighbors,
        );
    }

    fn record_neighbors<'a, N>(
        &mut self,
        ids: impl IntoIterator<Item = &'a str>,
        directions: &[Direction],
        reason: Reason,
        neighbors: &mut N,
    ) where
        N: FnMut(&str, Direction) -> Vec<String>,
    {
        for id in ids {
            for &direction in directions {
                add_frontier(
                    &mut self.frontiers,
                    id,
                    direction,
                    reason,
                    neighbors(id, direction),
                );
            }
        }
    }

    fn required_records(&self, unit: &Unit) -> usize {
        let identity = Arc::as_ptr(&unit.group);
        let additional = if self.admitted_groups.contains_key(&identity) {
            0
        } else {
            unit.group
                .record_ids
                .iter()
                .filter(|member| !self.trace.contains(*member) && !self.context.contains(*member))
                .count()
        };
        self.trace.len() + self.context.len() + additional
    }

    fn admit(&mut self, unit: &Unit, depth: usize, next: &mut HashSet<String>) {
        let identity = Arc::as_ptr(&unit.group);
        if !self.admitted_groups.contains_key(&identity) {
            let direct: HashSet<_> = unit.trace_ids.iter().collect();
            for member in &unit.group.record_ids {
                if !self.trace.contains(member) && !direct.contains(member) {
                    self.context.insert(member.clone());
                }
            }
            self.admitted_groups
                .insert(identity, Arc::clone(&unit.group));
        }
        for member in &unit.trace_ids {
            self.context.remove(member);
            self.trace.insert(member.clone());
            if self
                .seen_depth
                .get(member)
                .is_none_or(|previous| depth < *previous)
            {
                self.seen_depth.insert(member.clone(), depth);
                next.insert(member.clone());
            }
        }
    }

    fn finish(self) -> Selection {
        let FrontierReport {
            frontier,
            stopped_by,
        } = finish_frontiers(self.frontiers);
        let mut trace_ids: Vec<_> = self.trace.into_iter().collect();
        sort_ids(&mut trace_ids);
        let mut context_ids: Vec<_> = self.context.into_iter().collect();
        sort_ids(&mut context_ids);
        Selection {
            trace_ids,
            context_ids,
            frontier,
            blocked_event: self.blocked_event,
            stopped_by,
        }
    }
}
