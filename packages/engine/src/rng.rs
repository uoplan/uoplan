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
