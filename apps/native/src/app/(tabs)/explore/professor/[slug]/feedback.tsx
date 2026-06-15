import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";

import { FeedbackPageContent } from "@/components/explore/feedback-page-content";
import { useAppData, useFeedback } from "@/data/data-provider";
import { professorDetail } from "@/data/explore-detail";
import { feedbackViewsForProfessor } from "@/data/feedback-data";

/** Professor student-evaluation page — section views joined by professor name. */
export default function ProfessorFeedbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slug: string }>();
  const slug = String(params.slug ?? "");
  const { bundle, index } = useAppData();
  const feedback = useFeedback();
  const detail = useMemo(() => professorDetail(bundle, index, slug), [bundle, index, slug]);
  const name = detail?.professor.name ?? "Professor";
  const views = useMemo(() => feedbackViewsForProfessor(feedback, name), [feedback, name]);

  return (
    <FeedbackPageContent
      title={name}
      backLabel={name}
      onBack={() => router.back()}
      views={views}
      questions={feedback.questions}
    />
  );
}
