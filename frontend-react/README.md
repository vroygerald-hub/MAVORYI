# MAVORYI storefront

The React storefront includes category filters, three-step product image sliders, product details, a persistent cart, checkout, About and Contact pages, and a members-only, view-only upcoming collection. The collection is linked from the home-page Explore Upcoming Collection button. Store navigation uses hash routes.

Customer sign-up, login, password recovery, and profile updates use Supabase Auth. The storefront and admin each use a separate Supabase Auth storage key and local sign-out, so their browser sessions do not replace or end one another. You can use the same admin email and password on both pages, but must sign in separately on each. After this change, sign in again on each page; the old shared session is not reused. Supabase Auth stores account credentials; the latest schema also keeps a protected `public.customer_profiles` directory with member names, emails, signup dates, and storefront activity for the admin dashboard.

## Run locally

```sh
cd frontend-react
npm install
npm run dev
```

For a production build, run `npm run build`. Netlify is configured in the repository root to build this directory and publish `dist`.

In Supabase Authentication URL Configuration, set the production Netlify site as the Site URL and allow the local Vite URL and production site URL as redirects. Email confirmation behavior is controlled by the Supabase project's Auth settings.

```sh
npm run lint
```

The separate React `MyBackdoor.html` build entry is available at `/MyBackdoor.html` and is not linked from the storefront. It requires a Supabase account whose `app_metadata.role` is `admin`, and provides order status management, live order updates, a customer directory with active/new/established account counts, product creation and editing (including images and descriptions), price editing, upcoming collection management, and an anonymous daily unique-browser graph. Active customers were signed in with the storefront open in the last 30 minutes; new accounts were created in the last 30 days. Apply the latest `supabase/schema.sql` before using these features. Keep Supabase row-level security enabled; an unlinked URL is not an access-control mechanism.

The root PHP files are retained for the legacy PHP pages and fallback. Netlify does not execute those files, but the React storefront and its customer accounts no longer depend on them.
