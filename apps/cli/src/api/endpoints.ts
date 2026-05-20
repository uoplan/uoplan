const BASE_PSC = "https://www.uocampus.uottawa.ca/psc/csprpr9www/EMPLOYEE/SA/c/";

export const ENDPOINTS = {
  termList: `${BASE_PSC}SA_LEARNER_SERVICES.SSR_SSENRL_LIST.GBL`,
  enrollCart: `${BASE_PSC}SA_LEARNER_SERVICES_2.SSR_SSENRL_CART.GBL`,
} as const;
