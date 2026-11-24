# MAVORYI Supabase Setup

The React storefront can be published as a static site on Netlify. Supabase stores the product catalog, customer orders, and protected customer directory; it authenticates customers and admins and stores anonymous daily visitor counts. Do not put a Supabase `service_role` key in the website.

## 1. Create the database

1. Open your Supabase project.
2. Open the SQL Editor and run the latest [`supabase/schema.sql`](supabase/schema.sql).
3. Confirm the `public.orders`, `public.customer_profiles`, and `public.upcoming_products` tables exist and row-level security is enabled.

The public storefront can insert valid new orders, but it cannot read or change orders. Only authenticated users whose `app_metadata.role` is `admin` can read or update order statuses.

## 2. Configure the browser client

The React app reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in [`frontend-react/src/lib/supabase.js`](../frontend-react/src/lib/supabase.js). Set them in Netlify's environment variables to the project URL and public anon/publishable key from Supabase project API settings. These browser values are public; row-level security must protect all data.

Never put the `service_role` key in Netlify variables exposed to the frontend or in any frontend script.

## 3. Configure customer authentication

1. In Supabase Authentication settings, enable the Email provider.
2. Set the Site URL to the deployed Netlify site and add the production URL plus local Vite URLs (for example `http://127.0.0.1:5173/**`) to the allowed redirect URLs.
3. Choose whether email confirmation is required. With confirmation enabled, customers must confirm the signup email before logging in.

The React sign-up form creates a Supabase Auth user and stores the email in Auth and the member name in user metadata. Supabase manages passwords securely; the website never stores or reveals a customer's password. The storefront and admin use separate Auth storage keys and local-only sign-out, so each page has an independent session. An admin may use the same email and password on both pages but must sign in separately on each. Existing sessions from the former shared storage key are not reused; sign in again on both pages after deploying this change. Login, logout, password recovery, and profile updates use Supabase Auth directly; the React account experience does not require the PHP API or the local PostgreSQL `users` table. The “Forgot your password?” link sends a recovery email and returns customers to the React app to choose a new password. Configure an SMTP provider in Supabase for dependable production email delivery.

The latest `supabase/schema.sql` creates `public.customer_profiles`, backfills existing Auth accounts, and automatically mirrors new signups. While signed in with the storefront open, the app records a last-active timestamp every five minutes and when a hidden tab becomes visible. The admin **Customers** section refreshes every minute while open: “active” means a storefront activity timestamp within 30 minutes, “new” means an account created within 30 days, and older accounts are marked established. Previously existing customers have no historical activity timestamp; they appear inactive until they next use the storefront. Row-level security lets customers read only their own profile and lets admins read the directory.

## 4. Create the admin account

1. In Supabase Authentication, create an admin user with an email and password. Customer sign-up does not grant admin access.
2. In the Supabase user details, set the user's **app metadata** to include:

```json
{"role":"admin"}
```

Use app metadata, not user-editable user metadata. The dashboard and database policies both check this role. Do not share the admin password in chat or commit it to the repository.

## 5. Deploy and test

Serve the site from localhost or deploy it over HTTPS; browser auth and hosted Supabase requests should not be tested from a raw `file://` URL. Open the React admin page at `/MyBackdoor.html` and sign in with the admin account. The previous static-site files are preserved under `old file/`. Submit a test order from the storefront, then confirm it appears in the dashboard and that a non-admin account cannot view orders.

Customer orders include name, phone, email, delivery address and area, line items, payment timing, the chosen WhatsApp/email payment-contact channel, and the delivery-fee value. Prepayment delivery is free in Accra; outside Accra the fee remains unconfirmed. Pay-on-delivery fees also remain unconfirmed. Email is required so MAVORYI can send an order acknowledgment after confirming the order. New orders start with status `new`.

## Upcoming collection

The home-page **Explore Upcoming Collection** button is the storefront's only link to this view-only page. Customers must be signed in to see its products; the page has no purchase controls. The `public.upcoming_products` table can be read by authenticated members, while only admins can add, edit, or remove entries. In `/MyBackdoor.html`, open **Upcoming collection** to publish an item with its name, category, description, image, optional details, and expected availability. For image filenames, add the image to `frontend-react/public/images` before deploying. Run the latest schema above to create the table and access policies.

The admin's **Products & prices** section can also edit existing storefront product names, images, categories, colors, materials, descriptions, and prices. The latest schema adds the `description` column to `public.products`; use an image URL or a filename in `frontend-react/public/images`.

## Anonymous visitor graph

The React storefront records one anonymous random browser ID per UTC day in `public.site_visits`. The admin overview shows daily unique browsers for the last 30 days; it does not identify people or store names, email addresses, or IP addresses for analytics. Run the latest `supabase/schema.sql` in the SQL Editor to create the table, row-level security policies, and admin-only daily summary view. The graph starts filling as visitors use the updated React storefront.

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

Paystack has been removed. Pay-on-delivery orders remain available. Mobile money and bank payment methods are marked as coming soon until each provider's merchant API is approved and configured. A customer choosing to pay before delivery submits and saves the order first; the storefront then opens the customer's selected WhatsApp chat or an email addressed to MAVORYI, prefilled with the order and delivery details. The customer must send the prepared message to arrange payment. Prepayment delivery is free in Accra; delivery fees outside Accra are confirmed by MAVORYI.

Provider documentation and onboarding:

- MTN MoMo: [official developer portal](https://momodeveloper.mtn.com/). Its merchant collection API requires provider-issued credentials and a production merchant account.
- Telecel Cash: request the merchant collection API documentation from [Telecel Ghana Business](https://telecel.com.gh/contact-us/) or `business@telecel.com.gh`.
- Access Bank: ask Access Bank Ghana for its merchant e-commerce/payment API and settlement documentation via its [official contact page](https://www.ghana.accessbankplc.com/contact-us).

Do not send API keys or passwords in chat or commit them to the repository. Once merchant documentation and sandbox access are available, implement and test each provider in a server-side Supabase Edge Function; store credentials only with `supabase secrets set`. The browser must never call a provider with private credentials. Verify payment status server-side before marking an order as paid or clearing the cart.

Run the updated [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL Editor to allow the new provider method identifiers. Existing records from the previous payment integration are retained with a generic legacy payment label.

If the former payment Edge Function was deployed, remove that remote deployment from the Supabase Dashboard or run `supabase functions delete paystack-payment --project-ref YOUR_PROJECT_REF` after confirming the project reference.
