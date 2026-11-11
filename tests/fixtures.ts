export const sentinels = [
  "SENTINEL_ACCESS_TOKEN", "SENTINEL_PLAID_SECRET", "SENTINEL_AUTHORIZATION",
  "SENTINEL_FINANCIAL_PAYLOAD", "SENTINEL_SERVICE_ROLE_KEY",
];

export function sensitiveError(code = "INSTITUTION_DOWN") {
  return Object.assign(new Error(sentinels.join(" ")), {
    stack: sentinels.join(" "),
    config: { headers: { Authorization: sentinels[2], "PLAID-SECRET": sentinels[1] }, data: { access_token: sentinels[0] } },
    request: { body: sentinels[3] },
    response: { status: 503, data: { error_code: code, error_message: sentinels[0], request_id: sentinels[4], transactions: [sentinels[3]] } },
    cause: new Error(sentinels[4]),
  });
}
