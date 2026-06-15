import { Redirect } from "expo-router";

/**
 * The app opens directly on the Explore tab — there is no separate Home screen.
 * This index route just forwards "/" to "/explore" so the explore stack is the
 * initial destination and the bottom bar selects Explore.
 */
export default function Index() {
  return <Redirect href="/explore" />;
}
