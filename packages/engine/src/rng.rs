//! Mulberry32 seeded RNG and helpers, ported from `seededRandom.ts` /
//! `poolHelpers.ts`. Deterministic per seed (functional-parity randomness).

pub struct Rng {
    state: u32,
}

impl Rng {
    pub fn new(seed: u32) -> Self {
        Rng { state: seed }
    }

    /// Returns a float in [0, 1), matching the TS mulberry32 implementation.
    pub fn next_f64(&mut self) -> f64 {
        self.state = self.state.wrapping_add(0x6d2b_79f5);
        let mut t = self.state;
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        let r = (t ^ (t >> 14)) as f64;
        r / 4_294_967_296.0
    }
}

/// splitmix32-style finalizer so adjacent seeds map far apart (`scrambleSeed`).
pub fn scramble_seed(n: u32) -> u32 {
    let mut n = n;
    n = (n ^ (n >> 16)).wrapping_mul(0x45d9_f3b);
    n = (n ^ (n >> 16)).wrapping_mul(0x45d9_f3b);
    n ^ (n >> 16)
}

/// Fisher-Yates shuffle in place using the seeded RNG.
pub fn shuffle_in_place<T>(arr: &mut [T], rng: &mut Rng) {
    if arr.len() <= 1 {
        return;
    }
    let mut i = arr.len() - 1;
    while i > 0 {
        let j = (rng.next_f64() * ((i + 1) as f64)).floor() as usize;
        arr.swap(i, j.min(i));
        i -= 1;
    }
}

/// Weighted random permutation (Efraimidis–Spirakis A-Res): each item gets key
/// `u^(1/w)` for a fresh uniform `u`, and items are ordered by descending key so
/// higher-weight items tend to come first. Deterministic for a given seed
/// (consumes exactly `items.len()` RNG draws). Used to bias section ordering by
/// professor rating while keeping a randomized, per-seed arrangement.
pub fn weighted_shuffle<T>(items: Vec<T>, weights: &[f64], rng: &mut Rng) -> Vec<T> {
    if items.len() <= 1 {
        return items;
    }
    let mut keyed: Vec<(f64, T)> = items
        .into_iter()
        .enumerate()
        .map(|(i, item)| {
            let u = rng.next_f64().max(f64::MIN_POSITIVE);
            let w = weights
                .get(i)
                .copied()
                .unwrap_or(1.0)
                .max(f64::MIN_POSITIVE);
            (u.powf(1.0 / w), item)
        })
        .collect();
    keyed.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    keyed.into_iter().map(|(_, item)| item).collect()
}

/// Weighted random pick; returns the chosen index. Mirrors `weightedRandomPick`.
pub fn weighted_random_pick_index(weights: &[f64], rng: &mut Rng) -> usize {
    let total: f64 = weights.iter().sum();
    let mut r = rng.next_f64() * total;
    for (i, &w) in weights.iter().enumerate() {
        r -= w;
        if r <= 0.0 {
            return i;
        }
    }
    weights.len().saturating_sub(1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn weighted_shuffle_biases_high_weight_items_first() {
        // Two items: a high-weight ("H") and a low-weight ("L"). Across many
        // seeds the high-weight item should land first far more often, while
        // still being randomized (not always first).
        let mut high_first = 0u32;
        let trials = 2000u32;
        for seed in 0..trials {
            let mut rng = Rng::new(seed);
            let ordered = weighted_shuffle(vec!["H", "L"], &[4.0, 0.5], &mut rng);
            if ordered[0] == "H" {
                high_first += 1;
            }
        }
        assert!(
            high_first > trials * 3 / 4,
            "high-weight item should usually be first ({high_first}/{trials})"
        );
        assert!(
            high_first < trials,
            "ordering should remain randomized, not deterministic"
        );
    }

    #[test]
    fn weighted_shuffle_is_deterministic_per_seed() {
        let mut a = Rng::new(42);
        let mut b = Rng::new(42);
        let oa = weighted_shuffle(vec![1, 2, 3, 4], &[1.0, 2.0, 3.0, 4.0], &mut a);
        let ob = weighted_shuffle(vec![1, 2, 3, 4], &[1.0, 2.0, 3.0, 4.0], &mut b);
        assert_eq!(oa, ob);
    }
}
