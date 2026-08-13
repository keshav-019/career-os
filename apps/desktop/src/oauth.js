const crypto = require("node:crypto");
const https = require("node:https");
const { shell } = require("electron");

/**
 * Desktop's "Continue with Google/GitHub" flow. Neither provider's SDK popup works reliably inside an Electron
 * BrowserWindow (Google actively blocks OAuth from embedded webviews; this app also has no window.open handler
 * wired up at all), so both go through the system browser instead, matching the RFC 8252 pattern for native apps:
 * open the OS browser to the provider's consent screen with a *loopback* redirect_uri
 * (http://127.0.0.1:<helper-port>/oauth/:provider/callback, since the helper server already listens on a fixed,
 * well-known port), and have this same helper server catch that redirect.
 *
 * Google: uses a dedicated "Desktop application" OAuth client (public client_id + a client_secret that Google's
 * own docs say isn't meant to stay confidential for this client type - every installed copy of every app using
 * this pattern ships it). The secret is baked in at build time by scripts/prepare-oauth-secret.js, never
 * hardcoded here - see the repo-root .env.local.example.
 *
 * GitHub: has no native/public client type - code exchange always needs a real confidential secret, so this
 * relays the exchange to the already-deployed apps/mobile-backend service instead of holding a GitHub secret in
 * the desktop app itself (which would ship it in every installed copy, unlike Google's model above).
 */

const GOOGLE_DESKTOP_CLIENT_ID = "718498812867-j2qv9r2776q8fikd35r7qucl2dm643iu.apps.googleusercontent.com";
const GITHUB_CLIENT_ID = "Ov23libBHQfpolHiLqXZ";
const GITHUB_EXCHANGE_URL = "https://careerosbackend.projectyourown.com/api/oauth/github/exchange";
const PENDING_TIMEOUT_MS = 5 * 60 * 1000;

function loadGoogleClientSecret() {
  try {
    // eslint-disable-next-line global-require
    return require("./oauth-secret.generated.js").GOOGLE_DESKTOP_OAUTH_CLIENT_SECRET || "";
  } catch {
    return process.env.GOOGLE_DESKTOP_OAUTH_CLIENT_SECRET || "";
  }
}

function postForm(url, formBody) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(formBody).toString();
    const request = https.request(
      url,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json",
          "content-length": Buffer.byteLength(body)
        }
      },
      (response) => {
        let data = "";
        response.on("data", (chunk) => (data += chunk));
        response.on("end", () => {
          try {
            resolve({ status: response.statusCode || 0, payload: JSON.parse(data || "{}") });
          } catch {
            resolve({ status: response.statusCode || 0, payload: {} });
          }
        });
      }
    );
    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

function resultPage({ ok, message }) {
  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><title>CareerOS</title></head>
<body style="font-family: system-ui, sans-serif; background: #0b1020; color: #f5f5f7; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
  <div style="text-align: center; max-width: 360px;">
    <h2 style="margin-bottom: 8px;">${ok ? "Signed in" : "Sign-in failed"}</h2>
    <p style="color: #a1a1aa;">${message}</p>
  </div>
</body>
</html>`;
}

function registerOAuthRoutes(api, { host, port, log }) {
  const pending = new Map();

  function redirectUriFor(provider) {
    return `http://${host}:${port}/oauth/${provider}/callback`;
  }

  async function exchangeGoogleCode(code, redirectUri) {
    const clientSecret = loadGoogleClientSecret();
    if (!clientSecret) {
      throw new Error("Google sign-in isn't configured in this build.");
    }

    const { status, payload } = await postForm("https://oauth2.googleapis.com/token", {
      client_id: GOOGLE_DESKTOP_CLIENT_ID,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri
    });

    if (status < 200 || status >= 300 || !payload.access_token) {
      throw new Error(payload.error_description || payload.error || "Google rejected that sign-in attempt.");
    }

    return { accessToken: payload.access_token, idToken: payload.id_token || null };
  }

  function exchangeGithubCode(code, redirectUri) {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({ code, redirectUri });
      const request = https.request(
        GITHUB_EXCHANGE_URL,
        {
          method: "POST",
          headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) }
        },
        (response) => {
          let data = "";
          response.on("data", (chunk) => (data += chunk));
          response.on("end", () => {
            let payload = {};
            try {
              payload = JSON.parse(data || "{}");
            } catch {
              // ignore malformed body, handled by the ok-check below
            }
            if (!payload.ok || !payload.accessToken) {
              reject(new Error(payload.error || "GitHub rejected that sign-in attempt."));
              return;
            }
            resolve({ accessToken: payload.accessToken, idToken: null });
          });
        }
      );
      request.on("error", reject);
      request.write(body);
      request.end();
    });
  }

  api.post("/oauth/:provider/start", async (req, res) => {
    const provider = req.params.provider;
    if (provider !== "google" && provider !== "github") {
      return res.status(400).json({ ok: false, error: `Unsupported provider "${provider}".` });
    }
    if (provider === "google" && !loadGoogleClientSecret()) {
      return res.status(400).json({ ok: false, error: "Google sign-in isn't configured in this build." });
    }

    const state = crypto.randomBytes(16).toString("hex");
    const redirectUri = redirectUriFor(provider);
    const authorizeUrl =
      provider === "google"
        ? `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
            client_id: GOOGLE_DESKTOP_CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: "code",
            scope: "openid email profile",
            state,
            prompt: "select_account"
          })}`
        : `https://github.com/login/oauth/authorize?${new URLSearchParams({
            client_id: GITHUB_CLIENT_ID,
            redirect_uri: redirectUri,
            scope: "read:user user:email",
            state
          })}`;

    const resultPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(state);
        reject(new Error("Sign-in timed out."));
      }, PENDING_TIMEOUT_MS);
      pending.set(state, { provider, redirectUri, resolve, reject, timer });
    });

    try {
      await shell.openExternal(authorizeUrl);
    } catch (err) {
      pending.delete(state);
      log.error("Could not open system browser for sign-in", err);
      return res.status(500).json({ ok: false, error: "Could not open your browser for sign-in." });
    }

    try {
      const result = await resultPromise;
      res.json({ ok: true, provider, ...result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Sign-in failed." });
    }
  });

  api.get("/oauth/:provider/callback", async (req, res) => {
    const { code, state, error, error_description: errorDescription } = req.query;
    const entry = typeof state === "string" ? pending.get(state) : null;

    if (!entry) {
      res.status(400).send(resultPage({ ok: false, message: "This sign-in link has expired. Return to CareerOS and try again." }));
      return;
    }

    pending.delete(state);
    clearTimeout(entry.timer);

    if (error) {
      entry.reject(new Error(typeof errorDescription === "string" ? errorDescription : String(error)));
      res.send(resultPage({ ok: false, message: "Sign-in was cancelled." }));
      return;
    }
    if (typeof code !== "string" || !code) {
      entry.reject(new Error("Sign-in did not return an authorization code."));
      res.send(resultPage({ ok: false, message: "Sign-in did not complete." }));
      return;
    }

    try {
      const result = entry.provider === "google" ? await exchangeGoogleCode(code, entry.redirectUri) : await exchangeGithubCode(code, entry.redirectUri);
      entry.resolve(result);
      res.send(resultPage({ ok: true, message: "You can close this tab and return to CareerOS." }));
    } catch (err) {
      entry.reject(err);
      res.send(resultPage({ ok: false, message: err instanceof Error ? err.message : "Sign-in failed." }));
    }
  });
}

module.exports = { registerOAuthRoutes };
