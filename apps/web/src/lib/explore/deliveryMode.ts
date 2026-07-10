import type { NormalizedCourseCode, SchedulesData } from "@uoplan/core";
import { normalizeCourseCode } from "@uoplan/core";
import { resolveComponentId } from "@uoplan/core/courseAlias";

export type ExploreDeliveryMode = "virtual" | "in-person";

export type ExploreDeliverySets = {
  readonly virtual: ReadonlySet<NormalizedCourseCode>;
  readonly inPerson: ReadonlySet<NormalizedCourseCode>;
};

export type ExploreDeliveryPresenceIndex = {
  readonly virtualComponentsByTerm: ReadonlyMap<number, ReadonlySet<NormalizedCourseCode>>;
  readonly inPersonComponentsByTerm: ReadonlyMap<number, ReadonlySet<NormalizedCourseCode>>;
  readonly virtualComponents: ReadonlySet<NormalizedCourseCode>;
  readonly inPersonComponents: ReadonlySet<NormalizedCourseCode>;
};

const EMPTY_EXPLORE_DELIVERY_SET: ReadonlySet<NormalizedCourseCode> = Object.freeze(
  Object.defineProperties(new Set<NormalizedCourseCode>(), {
    add: { value: undefined },
    delete: { value: undefined },
    clear: { value: undefined },
  }),
);

const EMPTY_EXPLORE_DELIVERY_SETS: ExploreDeliverySets = Object.freeze({
  virtual: EMPTY_EXPLORE_DELIVERY_SET,
  inPerson: EMPTY_EXPLORE_DELIVERY_SET,
});

type MutableExploreDeliveryPresenceIndex = {
  virtualComponentsByTerm: Map<number, Set<NormalizedCourseCode>>;
  inPersonComponentsByTerm: Map<number, Set<NormalizedCourseCode>>;
  virtualComponents: Set<NormalizedCourseCode>;
  inPersonComponents: Set<NormalizedCourseCode>;
};

function copyReadonlySet(values: ReadonlySet<NormalizedCourseCode>): Set<NormalizedCourseCode> {
  return new Set(values);
}

function copyPresenceMap(
  values: ReadonlyMap<number, ReadonlySet<NormalizedCourseCode>>,
): Map<number, Set<NormalizedCourseCode>> {
  const clone = new Map<number, Set<NormalizedCourseCode>>();
  for (const [termId, components] of values) {
    clone.set(termId, copyReadonlySet(components));
  }
  return clone;
}

function snapshotExploreDeliveryPresence(
  presence: MutableExploreDeliveryPresenceIndex,
): ExploreDeliveryPresenceIndex {
  return Object.freeze({
    get virtualComponentsByTerm() {
      return copyPresenceMap(presence.virtualComponentsByTerm);
    },
    get inPersonComponentsByTerm() {
      return copyPresenceMap(presence.inPersonComponentsByTerm);
    },
    get virtualComponents() {
      return copyReadonlySet(presence.virtualComponents);
    },
    get inPersonComponents() {
      return copyReadonlySet(presence.inPersonComponents);
    },
  }) as ExploreDeliveryPresenceIndex;
}

export const EMPTY_EXPLORE_DELIVERY_PRESENCE = snapshotExploreDeliveryPresence({
  virtualComponentsByTerm: new Map(),
  inPersonComponentsByTerm: new Map(),
  virtualComponents: new Set(),
  inPersonComponents: new Set(),
});

function modeSetForTerm(
  byTerm: Map<number, Set<NormalizedCourseCode>>,
  termId: number,
): Set<NormalizedCourseCode> {
  let set = byTerm.get(termId);
  if (!set) {
    set = new Set<NormalizedCourseCode>();
    byTerm.set(termId, set);
  }
  return set;
}

function recordDeliveryModes(
  presence: MutableExploreDeliveryPresenceIndex,
  termId: number,
  componentId: NormalizedCourseCode,
  virtual: boolean,
  inPerson: boolean,
) {
  if (virtual) {
    modeSetForTerm(presence.virtualComponentsByTerm, termId).add(componentId);
    presence.virtualComponents.add(componentId);
  }
  if (inPerson) {
    modeSetForTerm(presence.inPersonComponentsByTerm, termId).add(componentId);
    presence.inPersonComponents.add(componentId);
  }
}

function sectionDeliveryModes(times: ReadonlyArray<{ virtual: boolean }>): {
  virtual: boolean;
  inPerson: boolean;
} {
  let virtual = false;
  let inPerson = false;
  for (const meeting of times) {
    if (meeting.virtual) {
      virtual = true;
    } else {
      inPerson = true;
    }
    if (virtual && inPerson) break;
  }
  return { virtual, inPerson };
}

export function buildExploreDeliveryPresenceIndex(
  allSchedules: SchedulesData[],
  componentByNorm: Map<NormalizedCourseCode, NormalizedCourseCode>,
): ExploreDeliveryPresenceIndex {
  const presence: MutableExploreDeliveryPresenceIndex = {
    virtualComponentsByTerm: new Map(),
    inPersonComponentsByTerm: new Map(),
    virtualComponents: new Set(),
    inPersonComponents: new Set(),
  };

  for (const schedData of allSchedules) {
    const termId = Number(schedData.termId);
    if (!Number.isInteger(termId) || termId <= 0) continue;

    for (const schedule of schedData.schedules) {
      const componentId = resolveComponentId(
        normalizeCourseCode(schedule.courseCode),
        componentByNorm,
      );
      let virtual = false;
      let inPerson = false;

      for (const sections of Object.values(schedule.components)) {
        for (const section of sections) {
          if (section.times.length === 0) continue;
          const modes = sectionDeliveryModes(section.times);
          virtual ||= modes.virtual;
          inPerson ||= modes.inPerson;
          if (virtual && inPerson) break;
        }
        if (virtual && inPerson) break;
      }

      if (!virtual && !inPerson) continue;
      recordDeliveryModes(presence, termId, componentId, virtual, inPerson);
    }
  }

  return snapshotExploreDeliveryPresence(presence);
}

export function deliverySetsForTerm(
  index: ExploreDeliveryPresenceIndex,
  termId: number | null,
): ExploreDeliverySets {
  if (termId === null) {
    return {
      virtual: copyReadonlySet(index.virtualComponents),
      inPerson: copyReadonlySet(index.inPersonComponents),
    };
  }

  const virtualByTerm = index.virtualComponentsByTerm;
  const inPersonByTerm = index.inPersonComponentsByTerm;
  const virtual = virtualByTerm.get(termId);
  const inPerson = inPersonByTerm.get(termId);
  if (!virtual && !inPerson) return EMPTY_EXPLORE_DELIVERY_SETS;

  return {
    virtual: virtual ? copyReadonlySet(virtual) : EMPTY_EXPLORE_DELIVERY_SET,
    inPerson: inPerson ? copyReadonlySet(inPerson) : EMPTY_EXPLORE_DELIVERY_SET,
  };
}
