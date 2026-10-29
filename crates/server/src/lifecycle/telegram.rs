use reqwest::Client;
use serde_json::json;
use std::time::Duration;

const TELEGRAM_API: &str = "https://api.telegram.org";

/// Basic shape check — full auth is proven by sendMessage.
pub fn validate_bot_token(token: &str) -> bool {
    let token = token.trim();
    if token.len() < 20 || token.len() > 200 {
        return false;
    }
    let Some((id, secret)) = token.split_once(':') else {
        return false;
    };
    !id.is_empty()
        && id.chars().all(|c| c.is_ascii_digit())
        && secret.len() >= 10
        && secret
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

pub fn validate_chat_id(chat_id: &str) -> bool {
    let chat_id = chat_id.trim();
    if chat_id.is_empty() || chat_id.len() > 128 {
        return false;
    }
    if let Some(rest) = chat_id.strip_prefix('@') {
        return !rest.is_empty() && rest.chars().all(|c| c.is_ascii_alphanumeric() || c == '_');
    }
    // Numeric chat / group ids (may be negative for groups).
    let digits = chat_id.strip_prefix('-').unwrap_or(chat_id);
    !digits.is_empty() && digits.chars().all(|c| c.is_ascii_digit())
}

pub fn mask_chat_id(chat_id: &str) -> String {
    let chat_id = chat_id.trim();
    if chat_id.starts_with('@') {
        return chat_id.to_string();
    }
    if chat_id.len() <= 4 {
        return format!("chat …{chat_id}");
    }
    format!("chat …{}", &chat_id[chat_id.len() - 4..])
}

pub async fn send_telegram_message(
    bot_token: &str,
    chat_id: &str,
    text: &str,
) -> Result<(), String> {
    let bot_token = bot_token.trim();
    let chat_id = chat_id.trim();
    if !validate_bot_token(bot_token) {
        return Err("Invalid Telegram bot token".into());
    }
    if !validate_chat_id(chat_id) {
        return Err("Invalid Telegram chat id".into());
    }
    if text.trim().is_empty() {
        return Err("Empty Telegram message".into());
    }

    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("failed to build http client: {e}"))?;

    let url = format!("{TELEGRAM_API}/bot{bot_token}/sendMessage");
    let response = client
        .post(&url)
        .json(&json!({
            "chat_id": chat_id,
            "text": text,
            "disable_web_page_preview": true,
        }))
        .send()
        .await
        .map_err(|e| format!("Telegram request failed: {e}"))?;

    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("Telegram API {status}: {body}"));
    }
    let parsed: serde_json::Value =
        serde_json::from_str(&body).unwrap_or_else(|_| json!({ "ok": false }));
    if parsed.get("ok").and_then(|v| v.as_bool()) != Some(true) {
        return Err(format!("Telegram API rejected message: {body}"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_typical_bot_token_and_chat_ids() {
        assert!(validate_bot_token(
            "123456789:AAExeampleToken_With-Chars0123456789"
        ));
        assert!(validate_chat_id("-1001234567890"));
        assert!(validate_chat_id("12345"));
        assert!(validate_chat_id("@epure_alerts"));
        assert!(!validate_bot_token("not-a-token"));
        assert!(!validate_chat_id(""));
        assert!(!validate_chat_id("@bad name"));
    }
}
