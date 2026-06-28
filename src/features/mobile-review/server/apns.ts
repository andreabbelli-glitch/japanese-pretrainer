import { connect } from "node:http2";
import { createPrivateKey, createSign } from "node:crypto";

export type MobileReviewApnsResult =
  | { reason?: never; sent: true }
  | { reason: string; sent: false };

const APNS_REQUEST_TIMEOUT_MS = 8_000;

export async function sendMobileReviewDueNotification(input: {
  deviceToken: string;
  dueCount: number;
}): Promise<MobileReviewApnsResult> {
  const config = loadApnsConfig();

  if (!config) {
    return {
      reason: "apns_not_configured",
      sent: false
    };
  }

  let token: string;

  try {
    token = createApnsProviderToken(config);
  } catch {
    return {
      reason: "apns_token_error",
      sent: false
    };
  }

  const client = connect(config.host);

  try {
    const response = await new Promise<{ body: string; status: number }>(
      (resolve, reject) => {
        const request = client.request({
          ":method": "POST",
          ":path": `/3/device/${input.deviceToken}`,
          authorization: `bearer ${token}`,
          "apns-priority": "10",
          "apns-push-type": "alert",
          "apns-topic": config.bundleId
        });
        let status = 0;
        let body = "";
        let settled = false;
        const timer = setTimeout(() => {
          finish(() => reject(new Error("apns_timeout")));
        }, APNS_REQUEST_TIMEOUT_MS);

        const finish = (callback: () => void) => {
          if (settled) {
            return;
          }

          settled = true;
          clearTimeout(timer);
          callback();
        };

        request.setEncoding("utf8");
        client.once("error", (error) => {
          finish(() => reject(error));
        });
        request.on("response", (headers) => {
          status = Number(headers[":status"] ?? 0);
        });
        request.on("data", (chunk: string) => {
          body += chunk;
        });
        request.on("end", () => {
          finish(() => resolve({ body, status }));
        });
        request.on("error", (error) => {
          finish(() => reject(error));
        });
        request.end(
          JSON.stringify({
            aps: {
              alert: {
                body:
                  input.dueCount === 1
                    ? "Hai 1 card pronta in Review."
                    : `Hai ${input.dueCount} card pronte in Review.`,
                title: "Review pronta"
              },
              sound: "default"
            }
          })
        );
      }
    );

    if (response.status >= 200 && response.status < 300) {
      return { sent: true };
    }

    return {
      reason: `apns_http_${response.status}${response.body ? `:${response.body}` : ""}`,
      sent: false
    };
  } catch (error) {
    return {
      reason:
        error instanceof Error && error.message === "apns_timeout"
          ? "apns_timeout"
          : "apns_transport_error",
      sent: false
    };
  } finally {
    client.close();
  }
}

function loadApnsConfig() {
  const bundleId = process.env.MOBILE_REVIEW_APNS_BUNDLE_ID?.trim();
  const keyId = process.env.MOBILE_REVIEW_APNS_KEY_ID?.trim();
  const privateKey = process.env.MOBILE_REVIEW_APNS_PRIVATE_KEY?.trim();
  const teamId = process.env.MOBILE_REVIEW_APNS_TEAM_ID?.trim();

  if (!bundleId || !keyId || !privateKey || !teamId) {
    return null;
  }

  const environment =
    process.env.MOBILE_REVIEW_APNS_ENVIRONMENT?.trim() === "production"
      ? "production"
      : "sandbox";

  return {
    bundleId,
    host:
      environment === "production"
        ? "https://api.push.apple.com"
        : "https://api.sandbox.push.apple.com",
    keyId,
    privateKey: privateKey.replaceAll("\\n", "\n"),
    teamId
  };
}

function createApnsProviderToken(config: {
  keyId: string;
  privateKey: string;
  teamId: string;
}) {
  const header = Buffer.from(
    JSON.stringify({
      alg: "ES256",
      kid: config.keyId
    })
  ).toString("base64url");
  const claims = Buffer.from(
    JSON.stringify({
      iat: Math.floor(Date.now() / 1000),
      iss: config.teamId
    })
  ).toString("base64url");
  const signer = createSign("SHA256");

  signer.update(`${header}.${claims}`);
  signer.end();

  const signature = signer.sign(
    {
      dsaEncoding: "ieee-p1363",
      key: createPrivateKey(config.privateKey)
    },
    "base64url"
  );

  return `${header}.${claims}.${signature}`;
}
