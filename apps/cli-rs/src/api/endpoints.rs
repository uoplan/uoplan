const BASE_PSC: &str =
    "https://www.uocampus.uottawa.ca/psc/csprpr9www/EMPLOYEE/SA/c/";

pub fn term_list() -> String {
    format!("{}SA_LEARNER_SERVICES.SSR_SSENRL_LIST.GBL", BASE_PSC)
}

pub fn enroll_cart() -> String {
    format!("{}SA_LEARNER_SERVICES_2.SSR_SSENRL_CART.GBL", BASE_PSC)
}
