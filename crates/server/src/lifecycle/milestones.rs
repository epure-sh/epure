pub const EVENT_MILESTONES: [i64; 4] = [100, 500, 1_000, 5_000];
pub const USER_MILESTONES: [i32; 3] = [10, 50, 100];

/// Highest event-count milestone crossed on this ingest (prior → new).
pub fn crossed_event_milestone(prior_count: i64, new_count: i64) -> Option<i64> {
    for threshold in EVENT_MILESTONES.into_iter().rev() {
        if prior_count < threshold && new_count >= threshold {
            return Some(threshold);
        }
    }
    None
}

/// Highest unique-user milestone crossed on this ingest (prior → new).
pub fn crossed_user_milestone(prior_count: i32, new_count: i32) -> Option<i32> {
    for threshold in USER_MILESTONES.into_iter().rev() {
        if prior_count < threshold && new_count >= threshold {
            return Some(threshold);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn event_milestone_fires_on_crossing() {
        assert_eq!(crossed_event_milestone(99, 100), Some(100));
        assert_eq!(crossed_event_milestone(499, 500), Some(500));
        assert_eq!(crossed_event_milestone(100, 101), None);
        assert_eq!(crossed_event_milestone(50, 200), Some(100));
    }

    #[test]
    fn user_milestone_fires_on_crossing() {
        assert_eq!(crossed_user_milestone(9, 10), Some(10));
        assert_eq!(crossed_user_milestone(49, 50), Some(50));
        assert_eq!(crossed_user_milestone(10, 11), None);
    }
}
