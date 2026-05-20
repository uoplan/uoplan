use anyhow::{anyhow, Result};
use cliclack::{intro, multiselect, outro, outro_cancel, select, spinner};

use crate::api::cart::{add_to_cart, list_cart, CartItem};
use crate::api::endpoints;
use crate::api::enrollment::{submit_cart_action, ACTION_DELETE, ACTION_ENROL};
use crate::api::PeopleSoftClient;
use crate::auth::get_session;
use crate::error::NoCookiesError;

async fn cart_url_from_session() -> Result<(PeopleSoftClient, String)> {
    let session = get_session().await.ok_or_else(|| anyhow!(NoCookiesError))?;
    let cart_url = session
        .cart_url
        .clone()
        .unwrap_or_else(endpoints::enroll_cart);
    let client = PeopleSoftClient::new(session)?;
    Ok((client, cart_url))
}

fn item_label(item: &CartItem) -> String {
    item.course_code.clone()
}

fn item_hint(item: &CartItem) -> String {
    item.instructors.join(", ")
}

pub async fn interactive() -> Result<()> {
    intro("uoplan cart")?;
    let (client, cart_url) = cart_url_from_session().await?;
    loop {
        let sp = spinner();
        sp.start("Loading cart…");
        let items = list_cart(&client, &cart_url).await?;
        sp.stop("Cart loaded");

        if items.is_empty() {
            outro("Your cart is empty.")?;
            return Ok(());
        }

        let mut prompt = multiselect("Select courses");
        for item in &items {
            prompt = prompt.item(item.bufnum, item_label(item), item_hint(item));
        }
        let selected_bufnums: Vec<i64> = match prompt.required(true).interact() {
            Ok(v) => v,
            Err(_) => {
                outro_cancel("Cancelled.")?;
                return Ok(());
            }
        };

        let action = match select("What would you like to do?")
            .item("enrol", "Enrol", "")
            .item("delete", "Delete from cart", "")
            .interact()
        {
            Ok(v) => v,
            Err(_) => {
                outro_cancel("Cancelled.")?;
                return Ok(());
            }
        };

        let action_code = match action {
            "enrol" => ACTION_ENROL,
            "delete" => ACTION_DELETE,
            _ => continue,
        };

        let sp = spinner();
        sp.start(if action == "delete" {
            "Deleting…"
        } else {
            "Submitting enrolment…"
        });
        let result =
            submit_cart_action(&client, &cart_url, &selected_bufnums, action_code).await?;
        sp.stop("Done");

        if result.errors.is_empty() {
            cliclack::log::success("Success")?;
        } else {
            for e in &result.errors {
                cliclack::log::error(e)?;
            }
        }
    }
}

pub async fn add(class_number: &str) -> Result<()> {
    intro("uoplan cart add")?;
    let (client, cart_url) = cart_url_from_session().await?;
    let sp = spinner();
    sp.start(&format!("Adding class {} to cart…", class_number));
    add_to_cart(&client, &cart_url, class_number).await?;
    sp.stop("Added");
    outro("Class added to cart.")?;
    Ok(())
}

pub async fn enrol() -> Result<()> {
    intro("uoplan enrol")?;
    let (client, cart_url) = cart_url_from_session().await?;
    let sp = spinner();
    sp.start("Loading cart…");
    let items = list_cart(&client, &cart_url).await?;
    sp.stop("Cart loaded");

    if items.is_empty() {
        outro("Your cart is empty.")?;
        return Ok(());
    }

    let mut prompt = multiselect("Select courses to enrol");
    for item in &items {
        prompt = prompt.item(item.bufnum, item_label(item), item_hint(item));
    }
    let selected_bufnums: Vec<i64> = match prompt.required(true).interact() {
        Ok(v) => v,
        Err(_) => {
            outro_cancel("Cancelled.")?;
            return Ok(());
        }
    };

    let sp = spinner();
    sp.start("Enrolling…");
    let result = submit_cart_action(&client, &cart_url, &selected_bufnums, ACTION_ENROL).await?;
    sp.stop("Done");

    if result.errors.is_empty() {
        outro("Enrolled successfully.")?;
    } else {
        for e in &result.errors {
            cliclack::log::error(e)?;
        }
        outro_cancel("Enrolment completed with errors.")?;
    }
    Ok(())
}
