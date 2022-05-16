// @ts-check
import { resolve } from "path";
import express from "express";
import cookieParser from "cookie-parser";
import { Shopify, ApiVersion } from "@shopify/shopify-api";
import crypto from "crypto";
import async from "async";
import bodyParser from "body-parser";
import getRawBody from 'raw-body';
import * as model from "../model/index.js";
import { upsert } from "../model/index.js";
import { genNewSku, getVariantsByProducts } from "../src/utils/util.js";
import {CREATE_APP_USAGE_RECORD, GET_SHOP_COLLECTIONS, UPDATE_PRODUCT_VARIANT_SKU} from './handler.js';
import "dotenv/config";

import applyAuthMiddleware from "./middleware/auth.js";
import verifyRequest from "./middleware/verify-request.js";

const USE_ONLINE_TOKENS = true;
const TOP_LEVEL_OAUTH_COOKIE = "shopify_top_level_oauth";

const PORT = parseInt(process.env.PORT || "8081", 10);
const isTest = process.env.NODE_ENV === "test" || !!process.env.VITE_TEST_BUILD;

Shopify.Context.initialize({
  API_KEY: process.env.SHOPIFY_API_KEY,
  API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
  SCOPES: process.env.SCOPES.split(","),
  HOST_NAME: process.env.HOST.replace(/https:\/\//, ""),
  API_VERSION: ApiVersion.April22,
  IS_EMBEDDED_APP: true,
  // This should be replaced with your preferred storage strategy
  SESSION_STORAGE: new Shopify.Session.MemorySessionStorage(),
});

// Storing the currently active shops in memory will force them to re-login when your server restarts. You should
// persist this object in your app.
const ACTIVE_SHOPIFY_SHOPS = {};
Shopify.Webhooks.Registry.addHandler("APP_UNINSTALLED", {
  path: "/webhooks/app_uninstall",
  webhookHandler: async (topic, shop, body) => {
    delete ACTIVE_SHOPIFY_SHOPS[shop]
  },
});

// export for test use only
export async function createServer(
  root = process.cwd(),
  isProd = process.env.NODE_ENV === "production"
) {
  const app = express();
  app.set("top-level-oauth-cookie", TOP_LEVEL_OAUTH_COOKIE);
  app.set("active-shopify-shops", ACTIVE_SHOPIFY_SHOPS);
  app.set("use-online-tokens", USE_ONLINE_TOKENS);
  app.use(bodyParser.text() )
  app.use(cookieParser(Shopify.Context.API_SECRET_KEY));

  applyAuthMiddleware(app);

  app.post("/webhooks/app_uninstall", verifyShopifyWebhooks, async (req, res) => {
    try {
      await Shopify.Webhooks.Registry.process(req, res);
      console.log(`Webhook processed, returned status code 200`);
    } catch (error) {
      console.log(`Failed to process webhook: ${error}`);
      res.status(500).send(error.message);
    }
  });

  app.get("/products-count", verifyRequest(app), async (req, res) => {
    const session = await Shopify.Utils.loadCurrentSession(req, res, true);
    const { Product } = await import(
      `@shopify/shopify-api/dist/rest-resources/${Shopify.Context.API_VERSION}/index.js`
    );

    const countData = await Product.count({ session });
    res.status(200).send(countData);
  });

// app 拉取配置
  app.get("/app/getConfig", async (req, res) => {
    const session = await Shopify.Utils.loadCurrentSession(req, res, true);
    const client = new Shopify.Clients.Graphql(
        session.shop,
        session.accessToken
    );
    const { queryId } = model;
    try {
      const shopId = session.shop;
      // const res = await queryId(shopId);
      // const productsCount = await getProductsCount();
      const [config, collections] = await Promise.all([
        queryId(shopId),
        client.query({data: GET_SHOP_COLLECTIONS}),
      ]);
      const collectionData = collections.body.data.collections;
      res.status(200).send({status: 200,
        msg: "ok",
        data: { config: config || {}, collections: collectionData },})
    } catch (err) {
      res.status(500).send({
        status: 4040,
        msg: "error",
        data: err,
      })
    }
  });

  async function verifyShopifyWebhooks(req, res, next) {
    const { headers, request } = req;
    const hmac = req.get('x-shopify-hmac-sha256')
    // const shop = req.get('x-shopify-shop-domain')
    const rawBody = await getRawBody(req)
    const digest = crypto
        .createHmac("SHA256", process.env.SHOPIFY_API_SECRET)
        .update(new Buffer(rawBody, "utf8"))
        .digest("base64");

    if (digest !== hmac) {
      res.status(401).send("Couldn't verify Shopify webhook HMAC")
    } else {
      console.log("Successfully verified Shopify webhook HMAC");
    }
    await next();
  }

  // app 获取产品变体列表
  app.get("/app/getProducts", async (req, res) => {
    const session = await Shopify.Utils.loadCurrentSession(req, res, true);
    // const countData = await Product.count({ session });
    const { id } = req.query;
    let shortId = "";
    if (id) {
      shortId = id.split("/").pop();
    }
    const products = await getProductsFunc(session, shortId);
    if (products) {
      res.status(200).send({
        status: 200,
        msg: "ok",
        data: products,
      })
    } else {
      res.status(200).send({
        status: 4040,
        msg: "ok",
        data: products})
    }
  });

  // 查询产品
  const getProductsFunc = async (session, id, limit = 10, cursor = 0) => {
    let data = {
      products: [],
      count: { count: 0 },
    };
    try {
      const { Product } = await import(
          `@shopify/shopify-api/dist/rest-resources/${Shopify.Context.API_VERSION}/index.js`
          );
      let params = {
        fields: "handle, id, images, status, title, variants, image",
      };
      params.since_id = cursor;
      let collectionProducts = {};
      if (id) {
        params = {
          ...params,
          collection_id: id,
          limit: 250,
        };
        collectionProducts = await Product.all({session, ...params})
        data = {
          products: collectionProducts,
          count: { count: collectionProducts.length },
        };
      } else {
        params.limit = limit;
        collectionProducts = await Promise.all([
          Product.all({session, ...params}),
          Product.count({session})
        ]);
        data = {
          products: collectionProducts[0],
          count: collectionProducts[1],
        };
      }

      return data;
    } catch (err) {
      console.log("list error", err);
      return null;
    }
  };

  // app 保存配置 / 更新
  app.post("/app/save", async (req, res) => {
    const session = await Shopify.Utils.loadCurrentSession(req, res, true);
    const { upsert } = model;
    const postData = JSON.parse(req.body);
    const shopId = session.shop;
    console.log("app-save received", { storeId: shopId, ...postData });
    try {
      let response = await upsert({ storeID: shopId, ...postData });
      res.status(200).send({status: 200});
    } catch (err) {
      console.log('SSSS', err)
      res.status(500).send({
        status: 4040,
        data: err,
      });
    }
  });
  // 更新sku
  app.post("/app/updateSku", async (req, res) => {
    const session = await Shopify.Utils.loadCurrentSession(req, res, true);
    try {
      const config = JSON.parse(req.body);
      await startUpdate(session, config, session.shop);
      res.status(200).send({
        status: 200,
        msg: "ok",
        data: { status: "start" },
      });
    } catch (err) {
      res.status(500).send({
        status: 4040,
        msg: "error",
        data: err,
      });
    }
  });
  app.get("/app/updateStatus", async (req, res) => {
    const session = await Shopify.Utils.loadCurrentSession(req, res, true);
    try {
      // const updateStatus = store.get("updateStatus");
      res.status(200).send({
        status: 200,
        msg: "ok",
        data: updateRes,
      });
    } catch (err) {
      res.status(500).send({
        status: 4040,
        msg: "error",
        data: err,
      });
    }
  });

  let updateRes = null;
  const startUpdate = async (session, config, shopId) => {
    const client = new Shopify.Clients.Graphql(
        session.shop,
        session.accessToken
    );
    // const variantsCount = await getProductVariantsCount();
    const { upsert } = model;
    const id = config.rulesRange === 1 ? config.collectId : "";
    let shortId = "";
    if (id) {
      shortId = id.split("/").pop();
    }
    let count1 = 0; // 正在更新第几个变体
    let times = 1; // 轮询了几次
    let cursor = 0; // 最后一个产品的id
    const LIMIT = 20; // 每次 更新多少个产品
    let whichProductIndex = {}; // 产品的更新记录
    let productUpdated = 0;
    console.log("-------------------开始执行---------------", Date.now());
    async function loopUpdate(cursor) {
      const productsObj = await getProductsFunc(session, shortId, LIMIT, cursor);
      const {
        products,
        count: { count },
      } = productsObj;
      if (products.length) {
        cursor = products[products.length - 1]["id"];
      }

      console.log("loopUpdate", times, count, cursor);
      let variants = getVariantsByProducts(products);
      if (config && !config.productRange) {
        variants = variants.filter((variant) => !variant.variantObj.sku);
      }
      // console.log("StartUPdate", config, products, variants.length);
      async.mapLimit(
          variants,
          6,
          async function (variant, callback) {
            // console.log(variant, 'current variant')
            try {
              const id = variant.variantObj.admin_graphql_api_id;
              let curIndex = 0;
              if (count1 === 0) {
                curIndex = variants.findIndex(
                    (vart) => vart.variantObj.admin_graphql_api_id === id
                );
              } else {
                curIndex = count1 + 5;
              }
              const sku = genNewSku(variant, config, curIndex);
              const response = await client.query({ data: UPDATE_PRODUCT_VARIANT_SKU(id, sku)});
              count1++;
              const { product_id } = variant.variantObj;
              if (!whichProductIndex[product_id]) {
                whichProductIndex[product_id] = {
                  variantsNum: variant.variants.length,
                  ids: [],
                };
              }
              if (!whichProductIndex[product_id].ids.includes(id)) {
                whichProductIndex[product_id].ids.push(id);
              }
              if (
                  whichProductIndex[product_id].ids.length ===
                  whichProductIndex[product_id].variantsNum
              ) {
                //   某一个产品更新完成
                productUpdated++;
              }
              // console.log(
              //   product_id,
              //   whichProductIndex[product_id].ids.length,
              //   whichProductIndex[product_id].variantsNum,
              //   productUpdated
              // );
              updateRes = {
                is_generating: true,
                products_updated: productUpdated,
                total_products: count,
                total_variant: count1 + 1,
              };
              callback && callback(null, variant);
            } catch (err) {
              console.log("has updated skur err:", err);
            }
          },
          async (err, results) => {
            if (err) throw err;
            times++;
            // console.log("loop hahahha", productUpdated, count);
            if (productUpdated < count) {
              await loopUpdate(cursor);
            } else {
              console.log(
                  "-=-=-=-=-=-=-=-, hahahhhahahah, 都更新完了哦",
                  Date.now()
              );
              updateRes = {
                is_generating: false,
                products_updated: count,
                total_products: count,
                total_variant: count1,
              };
              await upsert({ storeID: shopId, lastGen: count1 });
              const billing = await model.queryBilling(shopId);
              console.log("app usage payload", shopId, billing.subscription_id);
              await client.query({data: CREATE_APP_USAGE_RECORD(billing, count1)})
            }
          }
      );
    }
    await loopUpdate(cursor);
  };

  app.post("/graphql", verifyRequest(app), async (req, res) => {
    try {
      const response = await Shopify.Utils.graphqlProxy(req, res);
      res.status(200).send(response.body);
    } catch (error) {
      res.status(500).send(error.message);
    }
  });

  // Mandatory Webhooks
  app.post("/customers/data_request", verifyShopifyWebhooks, async (req, res) => {
    try {
      res.status(200);
    } catch (error) {
      console.log(`Failed to process webhook: ${error}`);
    }
  });
  app.post("/customers/redact", verifyShopifyWebhooks, async (req, res) => {
    try {
      res.status(200)
    } catch (error) {
      console.log(`Failed to process webhook: ${error}`);
    }
  });
  app.post("/shop/redact", verifyShopifyWebhooks, async (req, res) => {
    try {
      res.status(200)
    } catch (error) {
      console.log(`Failed to process webhook: ${error}`);
    }
  });

  app.use(express.json());

  app.use((req, res, next) => {
    const shop = req.query.shop;
    if (Shopify.Context.IS_EMBEDDED_APP && shop) {
      res.setHeader(
        "Content-Security-Policy",
        `frame-ancestors https://${shop} https://admin.shopify.com;`
      );
    } else {
      res.setHeader("Content-Security-Policy", `frame-ancestors 'none';`);
    }
    next();
  });

  app.use("/*", async (req, res, next) => {
    const shop = req.query.shop;
    const { queryBilling, upsertBilling } = model;
    const chargeId = req.query.charge_id;
    if (chargeId) {
      const session = app.get("currentSession");
      const { RecurringApplicationCharge } = await import(
          `@shopify/shopify-api/dist/rest-resources/${Shopify.Context.API_VERSION}/index.js`
          );
      const recurringObj = await RecurringApplicationCharge.find({session, id: chargeId}) // await ctx.restApi.queryBillingObj(chargeId);
      console.log("has charge id", chargeId, session, recurringObj);
      await upsertBilling({
        storeID: shop,
        charge_id: chargeId,
        name: recurringObj.name,
        price: recurringObj.price,
        status: recurringObj.status,
        billing_on: recurringObj.billing_on,
        activated_on: recurringObj.activated_on,
        cancelled_on: recurringObj.cancelled_on,
        trial_days: recurringObj.trial_days,
        trial_ends_on: recurringObj.trial_ends_on,
      });
    }
    // if (!ctx.hasSubscription) {
    //   delete ACTIVE_SHOPIFY_SHOPS[shop];
    // }
    // Detect whether we need to reinstall the app, any request from Shopify will
    // include a shop in the query parameters.
    if (app.get("active-shopify-shops")[shop] === undefined && shop) {
      res.redirect(`/auth?shop=${shop}`);
    } else {
      next();
    }
  });

  /**
   * @type {import('vite').ViteDevServer}
   */
  let vite;
  if (!isProd) {
    vite = await import("vite").then(({ createServer }) =>
      createServer({
        root,
        logLevel: isTest ? "error" : "info",
        server: {
          port: PORT,
          hmr: {
            protocol: "ws",
            host: "localhost",
            port: 64999,
            clientPort: 64999,
          },
          middlewareMode: "html",
        },
      })
    );
    app.use(vite.middlewares);
  } else {
    const compression = await import("compression").then(
      ({ default: fn }) => fn
    );
    const serveStatic = await import("serve-static").then(
      ({ default: fn }) => fn
    );
    const fs = await import("fs");
    app.use(compression());
    app.use(serveStatic(resolve("dist/client")));
    app.use("/*", (req, res, next) => {
      // Client-side routing will pick up on the correct route to render, so we always render the index here
      res
        .status(200)
        .set("Content-Type", "text/html")
        .send(fs.readFileSync(`${process.cwd()}/dist/client/index.html`));
    });
  }

  return { app, vite };
}

if (!isTest) {
  createServer().then(({ app }) => app.listen(PORT));
}
