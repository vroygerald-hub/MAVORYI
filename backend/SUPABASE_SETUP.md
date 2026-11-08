# MAVORYI Supabase Setup

The storefront is static HTML. Supabase stores customer orders and authenticates admins. Do not put a Supabase `service_role` key in this website.

## 1. Create the database

1. Create a Supabase project.
2. Open the SQL Editor and run [`supabase/schema.sql`](supabase/schema.sql).
3. Confirm the `public.orders` table exists and row-level security is enabled.

The public storefront can insert valid new orders, but it cannot read or change orders. Only authenticated users whose `app_metadata.role` is `admin` can read or update order statuses.

## 2. Configure the browser client

Open [`supabase-config.js`](supabase-config.js) and set the project URL and public anon/publishable key from Supabase project API settings:

```js
window.MAVORYI_SUPABASE_CONFIG = {
    url: "https://YOUR_PROJECT.supabase.co",
    anonKey: "YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY"
};
```

The anon/publishable key is intended for browser use and is not a substitute for the RLS policies. Never put the `service_role` key in this file or any frontend script.

## 3. Create the admin account

1. In Supabase Authentication, create an admin user with an email and password. Public sign-up is not provided by this site.
2. In the Supabase user details, set the user's **app metadata** to include:

```json
{"role":"admin"}
```

Use app metadata, not user-editable user metadata. The dashboard and database policies both check this role. Do not share the admin password in chat or commit it to the repository.

## 4. Deploy and test

Serve the site from localhost or deploy it over HTTPS; browser auth and hosted Supabase requests should not be tested from a raw `file://` URL. Open `admin.html` and sign in with the admin account. Submit a test order from `cart.html`, then confirm it appears in the dashboard and that a non-admin account cannot view orders.

Customer orders include name, phone, email, delivery address and area, line items, payment method, payment timing, and the delivery-fee value (null for pay-on-delivery until confirmed). Email is required so MAVORYI can send an order acknowledgment after confirming the order. New orders start with status `new`.

## Live admin notifications

The schema adds `public.orders` to the `supabase_realtime` publication. After running the updated schema, authenticated admins receive a live dashboard alert for new orders. If Realtime is unavailable, the dashboard still has a manual Refresh button.

## Admin email notifications

Email is sent by the server-side `notify-order` Edge Function using Resend. On a new order, MAVORYI receives an email with the order reference and dashboard link; the admin page contains the customer and delivery details. When an admin changes the order from `new` to `confirmed`, the customer receives an order acknowledgment. This email confirms receipt of the order, not payment.

1. Create a Resend account and verify a sending domain.
2. Install the Supabase CLI, link this folder to the project, and set function secrets directly in your terminal. Use real values only in the terminal or Supabase secret manager; do not commit them or send them in chat:

```text
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set RESEND_API_KEY=YOUR_RESEND_KEY ADMIN_EMAIL=YOUR_ADMIN_EMAIL ORDERS_FROM_EMAIL="MAVORYI Orders <orders@YOUR_VERIFIED_DOMAIN>" SITE_URL=https://YOUR_SITE_DOMAIN ORDER_WEBHOOK_SECRET=YOUR_RANDOM_WEBHOOK_SECRET
supabase functions deploy notify-order
```

`SITE_URL` must be your deployed HTTPS site. Generate `ORDER_WEBHOOK_SECRET` privately and keep it available for the next step. `supabase/config.toml` disables JWT verification for this function because database webhooks do not carry a user JWT; the function instead checks the secret header.

3. In Supabase Database Webhooks, create an HTTP `POST` webhook for `public.orders`, on `INSERT`, targeting `https://YOUR_PROJECT_REF.supabase.co/functions/v1/notify-order`.
4. Create a second HTTP `POST` webhook for `public.orders`, on `UPDATE`, targeting the same function URL. The function sends the customer email only when status changes to `confirmed`.
5. Add a custom request header named `x-order-webhook-secret` to both webhooks with the same `ORDER_WEBHOOK_SECRET` value set above.
6. Submit a test order with an email address. Confirm the admin email arrives and the order appears in the admin page. Change its status to `Confirmed` and confirm the customer acknowledgment arrives. Check the Edge Function logs and Resend delivery activity.

The dashboard alert is protected by the admin role and orders-table RLS. Before public launch, consider adding bot protection and rate limiting to public order submission to reduce spam.

## Online prepayment integrations

Paystack has been removed. Pay-on-delivery orders remain available. The storefront lists MTN MoMo, Telecel Cash, and Access Bank for prepayment, but automated online prepayment is intentionally unavailable until each provider's merchant API is approved and configured. During this setup period, customers selecting prepayment are directed to contact MAVORYI rather than being shown a fake or unverified payment result.

Provider documentation and onboarding:

- MTN MoMo: [official developer portal](https://momodeveloper.mtn.com/). Its merchant collection API requires provider-issued credentials and a production merchant account.
- Telecel Cash: request the merchant collection API documentation from [Telecel Ghana Business](https://telecel.com.gh/contact-us/) or `business@telecel.com.gh`.
- Access Bank: ask Access Bank Ghana for its merchant e-commerce/payment API and settlement documentation via its [official contact page](https://www.ghana.accessbankplc.com/contact-us).

Do not send API keys or passwords in chat or commit them to the repository. Once merchant documentation and sandbox access are available, implement and test each provider in a server-side Supabase Edge Function; store credentials only with `supabase secrets set`. The browser must never call a provider with private credentials. Verify payment status server-side before marking an order as paid or clearing the cart.

Run the updated [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL Editor to allow the new provider method identifiers. Existing records from the previous payment integration are retained with a generic legacy payment label.

If the former payment Edge Function was deployed, remove that remote deployment from the Supabase Dashboard or run `supabase functions delete paystack-payment --project-ref YOUR_PROJECT_REF` after confirming the project reference.
