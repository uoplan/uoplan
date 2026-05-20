const BASE_PSP = "https://www.uocampus.uottawa.ca/psp/csprpr9www/EMPLOYEE/SA/c/";
const BASE_PSC = "https://www.uocampus.uottawa.ca/psc/csprpr9www/EMPLOYEE/SA/c/";

export const ENDPOINTS = {
  // Term selection page (GET + POST for selecting a term)
  termList: `${BASE_PSC}SA_LEARNER_SERVICES.SSR_SSENRL_LIST.GBL`,
  // Enrollment pages
  enrollList: `${BASE_PSP}SA_LEARNER_SERVICES.SSR_SSENRL_LIST.GBL`,
  enrollCart: `${BASE_PSP}SA_LEARNER_SERVICES.SSR_SSENRL_CART.GBL`,
} as const;
