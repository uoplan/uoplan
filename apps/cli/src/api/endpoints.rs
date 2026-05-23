const BASE_PSC: &str =
    "https://www.uocampus.uottawa.ca/psc/csprpr9www/EMPLOYEE/SA/c/";

pub fn term_list() -> String {
    format!("{BASE_PSC}SA_LEARNER_SERVICES.SSR_SSENRL_LIST.GBL")
}

pub fn enroll_cart() -> String {
    format!("{BASE_PSC}SA_LEARNER_SERVICES_2.SSR_SSENRL_CART.GBL")
}
