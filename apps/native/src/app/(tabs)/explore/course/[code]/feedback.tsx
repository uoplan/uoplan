import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";

import { FeedbackPageContent } from "@/components/explore/feedback-page-content";
import { useFeedback } from "@/data/data-provider";
import { feedbackViewsForCourse } from "@/data/feedback-data";

/** Course student-evaluation page (sentiment / response rate / per-question trends). */
export default function CourseFeedbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string }>();
  const code = String(params.code ?? "");
  const feedback = useFeedback();
  const views = useMemo(() => feedbackViewsForCourse(feedback, code), [feedback, code]);

  return (
    <FeedbackPageContent
      title={code || "Course"}
      backLabel={code || "Course"}
      onBack={() => router.back()}
      views={views}
      questions={feedback.questions}
    />
  );
}
