/** Result of comparing explicit union size to non-honours term target. */
export type GlobalExplicitRule = {
  /** When true, every schedulable explicit course is pinned. */
  pinAllExplicit: boolean;
  /** When true, general-pool picks may only use courses in the explicit union. */
  explicitOnly: boolean;
};
