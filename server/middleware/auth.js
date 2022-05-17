import { Shopify } from "@shopify/shopify-api";

import topLevelAuthRedirect from "../helpers/top-level-auth-redirect.js";
import {
  GET_APP_SUBSCRIPTION_STATUS,
  GET_SUBSCRIPTION_URL,
} from "../handler.js";
import { getParamString } from "../../src/utils/util.js";
import { upsertBilling } from "../../model/index.js";

export default function applyAuthMiddleware(app) {
  app.get("/auth", async (req, res) => {
    if (!req.signedCookies[app.get("top-level-oauth-cookie")]) {
      return res.redirect(`/auth/toplevel?shop=${req.query.shop}`);
    }

    const redirectUrl = await Shopify.Auth.beginAuth(
      req,
      res,
      req.query.shop,
      "auth/callback",
      app.get("use-online-tokens")
    );

    res.redirect(redirectUrl);
  });

  app.get("/auth/toplevel", (req, res) => {
    res.cookie(app.get("top-level-oauth-cookie"), "1", {
      signed: true,
      httpOnly: true,
      sameSite: "strict",
    });

    res.set("Content-Type", "text/html");

    res.send(
      topLevelAuthRedirect({
        apiKey: Shopify.Context.API_KEY,
        hostName: Shopify.Context.HOST_NAME,
        shop: req.query.shop,
      })
    );
  });

  app.get("/auth/callback", async (req, res) => {
    try {
      const session = await Shopify.Auth.validateAuthCallback(
        req,
        res,
        req.query
      );

      const host = req.query.host;
      app.set(
        "active-shopify-shops",
        Object.assign(app.get("active-shopify-shops"), {
          [session.shop]: session.scope,
        })
      );
      app.set("currentSession", session);

      const response = await Shopify.Webhooks.Registry.register({
        shop: session.shop,
        accessToken: session.accessToken,
        topic: "APP_UNINSTALLED",
        path: "/webhooks",
      });
      console.log("webhook response in auth/callback", response);
      if (!response["APP_UNINSTALLED"].success) {
        console.log(
          `Failed to register APP_UNINSTALLED webhook: ${response.result}`
        );
      }
      const client = new Shopify.Clients.Graphql(
        session.shop,
        session.accessToken
      );
      const subScriptionResponse = await client.query({
        data: GET_APP_SUBSCRIPTION_STATUS,
      });
      const hasSubscription =
        subScriptionResponse?.body?.data?.currentAppInstallation
          ?.activeSubscriptions?.[0]?.status === "ACTIVE";
      console.log(
        "HHHHHHH",
        hasSubscription,
        JSON.stringify(subScriptionResponse)
      );
      if (hasSubscription) {
        // Redirect to app with shop parameter upon auth
        res.redirect(`/?shop=${session.shop}&host=${host}`);
      } else {
        const query_string = getParamString({ shop: session.shop, host });
        // await getSubscriptionUrl(ctx, query_string, shop);
        const subscriptionCallbackUrl = process.env.HOST + query_string;
        const appSubscriptionCreate = await client.query({
          data: {
            query: GET_SUBSCRIPTION_URL,
            variables: { returnUrl: subscriptionCallbackUrl },
          },
        });
        await upsertBilling({
          storeID: session.shop,
          subscription_id:
            appSubscriptionCreate.body.data.appSubscriptionCreate
              .appSubscription.lineItems[1].id,
        });
        console.log(
          "upsertBilling",
          JSON.stringify(
            appSubscriptionCreate.body.data.appSubscriptionCreate
              .confirmationUrl
          )
        );
        console.log(
          "comfirmationUrl",
          appSubscriptionCreate.body.data.appSubscriptionCreate.confirmationUrl
        );
        console.log("subscriptionCallbackUrl", subscriptionCallbackUrl);
        res.redirect(
          appSubscriptionCreate.body.data.appSubscriptionCreate.confirmationUrl
        );
      }
    } catch (e) {
      switch (true) {
        case e instanceof Shopify.Errors.InvalidOAuthError:
          res.status(400);
          res.send(e.message);
          break;
        case e instanceof Shopify.Errors.CookieNotFound:
        case e instanceof Shopify.Errors.SessionNotFound:
          // This is likely because the OAuth session cookie expired before the merchant approved the request
          res.redirect(`/auth?shop=${req.query.shop}`);
          break;
        default:
          res.status(500);
          res.send(e.message);
          break;
      }
    }
  });
}
