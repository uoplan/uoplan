import type { AnchorHTMLAttributes, ReactNode } from "react";
import { page } from "vitest/browser";
import { expect, test, vi } from "vitest";

import { SCHEDULE_COURSE_COUNT_MAX } from "@uoplan/store/generationDefaults";
import { renderWithProviders } from "../../test/renderWithProviders";
import { BasicCalendarSidebarControls } from "./BasicCalendarSidebarControls";

interface MockLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children?: ReactNode;
  params?: unknown;
  search?: unknown;
  to?: string;
}

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, params: _params, search: _search, to, ...props }: MockLinkProps) => (
      <a href={to ?? "#"} {...props}>
        {children}
      </a>
    ),
  };
});

test("caps basic additional electives by the courses already in the basket", async () => {
  const basketCourses = ["CSI 2110", "CSI 2120"];
  const additionalMax = SCHEDULE_COURSE_COUNT_MAX - basketCourses.length;
  const { store } = await renderWithProviders(<BasicCalendarSidebarControls />, {
    initialState: {
      basketCourses,
      additionalElectivesCount: 1,
    },
  });

  const count = page.getByLabelText("Electives this semester (additional)");
  await expect.element(count).toHaveValue("1");

  await count.fill(String(SCHEDULE_COURSE_COUNT_MAX));

  await expect.poll(() => store.getState().additionalElectivesCount).toBe(additionalMax);
});

test("clamps a stale basic additional-elective count when the basket already uses slots", async () => {
  const basketCourses = ["CSI 2110", "CSI 2120"];
  const additionalMax = SCHEDULE_COURSE_COUNT_MAX - basketCourses.length;
  const { store } = await renderWithProviders(<BasicCalendarSidebarControls />, {
    initialState: {
      basketCourses,
      additionalElectivesCount: SCHEDULE_COURSE_COUNT_MAX,
    },
  });

  await expect.poll(() => store.getState().additionalElectivesCount).toBe(additionalMax);
});

test("binds courses-this-semester independently and allows zero", async () => {
  const { store } = await renderWithProviders(<BasicCalendarSidebarControls />, {
    initialState: {
      coursesThisSemester: 4,
      additionalElectivesCount: 2,
    },
  });

  const courses = page.getByLabelText("Courses this semester");
  await expect.element(courses).toHaveValue("4");

  await courses.fill("0");
  expect(store.getState().coursesThisSemester).toBe(0);
  expect(store.getState().additionalElectivesCount).toBe(2);
});
