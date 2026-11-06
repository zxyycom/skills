use super::*;
use crate::source::{Root, capture};
mod parent_swap_fixture;
mod record_exit_fault;
mod record_fixtures;
mod resource_fixtures;
use parent_swap_fixture::*;
use record_exit_fault::*;
use record_fixtures::*;
use resource_fixtures::*;

mod backups_namespace;
mod candidate_and_modes;
mod capture_errors;
mod freshness;
mod outcomes;
mod owner_tree_moves;
mod owner_tree_races;
mod parent_guards;
mod rename_and_resource_move;
mod resource_recovery;

// Each rendezvous is used once by the test thread and once by the transaction worker.
// A missing hook or a failed test thread must fail rather than strand its peer.
struct TimedBarrier {
    arrivals: std::sync::Mutex<u8>,
    ready: std::sync::Condvar,
    phase: &'static str,
}
impl TimedBarrier {
    fn new(phase: &'static str) -> Self {
        Self {
            arrivals: std::sync::Mutex::new(0),
            ready: std::sync::Condvar::new(),
            phase,
        }
    }
    fn wait(&self) {
        assert!(
            self.wait_bounded(),
            "timed out waiting for {} rendezvous",
            self.phase
        );
    }
    fn wait_bounded(&self) -> bool {
        let mut arrivals = self.arrivals.lock().expect("rendezvous mutex poisoned");
        *arrivals += 1;
        if *arrivals == 2 {
            self.ready.notify_all();
            return true;
        }
        let (arrivals, _) = self
            .ready
            .wait_timeout_while(arrivals, std::time::Duration::from_secs(30), |count| {
                *count < 2
            })
            .expect("rendezvous mutex poisoned");
        *arrivals == 2
    }
}

fn wait_for_worker(
    entered: &TimedBarrier,
    worker: std::thread::JoinHandle<TransactionOutcome<()>>,
) -> std::thread::JoinHandle<TransactionOutcome<()>> {
    if entered.wait_bounded() {
        return worker;
    }
    if worker.is_finished() {
        match worker.join() {
            Ok(outcome) => panic!("worker exited before entered rendezvous: {outcome:?}"),
            Err(panic) => std::panic::resume_unwind(panic),
        }
    }
    panic!("timed out waiting for worker to reach entered rendezvous");
}
