export const GET_SHOP_COLLECTIONS = `
    {
      collections(first: 250, sortKey: UPDATED_AT, reverse: false) {
        edges {
          node {
            id
            title
          }
        }
        pageInfo {
          hasNextPage
        }
      }
    }
`;
export const UPDATE_PRODUCT_VARIANT_SKU = (id, sku) => `
    mutation productVariantUpdate {
      productVariantUpdate(
        input: {
          id: "${id}"
          sku: "${sku}"
        }
      ) {
        product {
          title
        }
        productVariant {
          id
          sku
        }
      }
    }
`;
export const CREATE_APP_USAGE_RECORD = (billing, count) => `
    mutation appUsageRecordCreate(
      $description: String!
      $price: MoneyInput!
      $subscriptionLineItemId: ID!
    ) {
      appUsageRecordCreate(
        description: "Updated ${count} skus"
        price: { amount: ${count} * 0.01, currencyCode: "USD" }
        subscriptionLineItemId: ${billing.subscription_id}
      ) {
        userErrors {
          field
          message
        }
        appUsageRecord {
          id
        }
      }
    }
`;

export const GET_APP_SUBSCRIPTION_STATUS = `
   {
    currentAppInstallation {
      activeSubscriptions {
        status
      }
    }
  }
`
export const GET_SUBSCRIPTION_URL = `
    mutation AppSubscriptionCreate($returnUrl: URL! ) {
      appSubscriptionCreate(
          name: "SKU RULES PREMIUM"
          returnUrl: $returnUrl
          test: false,
          trialDays: 3,
          lineItems: [
            {
              plan: {
                appRecurringPricingDetails: {
                    price: { amount: 5, currencyCode: USD }
                }
              }
            },
            {
              plan: {
                appUsagePricingDetails: {
                  cappedAmount: { amount: 10, currencyCode: USD }
                  terms: "$0.01 for 1 SKU"
                }
              }
            }
          ]
        ) {
            userErrors {
              field
              message
            }
            confirmationUrl
            appSubscription {
              id,
              lineItems {
                id,
              },
            }
        }
    }
`;
// 获取订阅信息
const queryBillingObj = async (chargeId, client) => {
    try {
        console.log("get queryBillingObj", chargeId);
        const data = await client.get({
            path: `recurring_application_charges/${chargeId}`,
        });
        return data.body.recurring_application_charge;
    } catch (err) {
        throw new Error("recurring_application_charges: " + err);
    }
};