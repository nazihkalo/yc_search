# Product analytics in PostHog

Use PostHog for signup, activation, retention, search activity, and question-category reports. The app sends explicit events with a stable Clerk user ID; it does not send question text, search text, names, or email addresses to PostHog.

## Configure collection

Set `POSTHOG_PROJECT_KEY` to the public project token and `POSTHOG_HOST` to `https://us.i.posthog.com` (US) or `https://eu.i.posthog.com` (EU) on the web service. Redeploy after changing either value. The Docker build accepts both values for pages rendered at build time. Omitting the key disables collection.

After deployment, open the app, sign in, run a search, open a company, and ask a question. Check **Activity** in PostHog for the events below, using your Clerk ID to distinguish the test session from customer traffic. A successful ingest HTTP response alone does not establish that the deployed app is collecting events.

Autocapture, replay, heatmaps, automatic pageviews, surveys, and exception capture are disabled. Pageviews use the pathname; query strings, fragments, and referrer attribution are removed before transmission. Browser blockers can suppress client events. Server events use Clerk's authenticated ID independently of browser tracking.

## Events and definitions

| Event | Meaning and useful properties |
| --- | --- |
| `$pageview` | Page visit or pathname change, with `page_path`. Filter changes do not create pageviews. |
| `user_signed_up` | Verified Clerk creation, using the original Clerk signup timestamp and a deterministic event ID. A missed webhook is recovered when the user first needs a database record. |
| `user_session_started` | Authenticated app load or sign-in, once per provider mount. Reloads create another event; use unique people for daily/weekly active users. |
| `preview_question_submitted` | Anonymous landing-page question attempt, with category metadata. |
| `preview_answer_completed`, `preview_answer_failed`, `preview_rate_limited` | Landing preview outcome. Failures contain a bounded reason, not the error text. |
| `search_submitted` | Nonempty committed search changes, including the 250 ms typing debounce. This is not a count of Enter presses. Includes `surface` and category metadata. |
| `search_results_loaded` | A completed results request. Includes result count, page, view, query length, and whether a query exists. Initial loads, filter changes, and pagination also count. |
| `search_failed` | A failed results request, excluding canceled requests. |
| `filters_changed` | Changed group names and total active-filter count; filter values are not sent. |
| `company_opened`, `vendor_opened` | Detail view, including public entity ID and page/panel surface. |
| `question_submitted` | Server-observed Copilot user turn. Includes `question_id`, category metadata, and surface. Info/connect requests and tool continuations are excluded. Retry events share a deterministic ID. |
| `assistant_run_completed` | Live Copilot run finished. `outcome=answer` requires nonempty assistant text; tool handoffs and empty completions are separate outcomes. Includes question ID, run ID, duration, and message count. Restoring messages does not emit this event. |
| `assistant_run_failed` | Runtime/transport failure, keyed by run ID with a bounded reason. No raw error message. |

Question category metadata contains `intent`, `topics`, `summary_type`, and `question_length`. Categories use local keyword rules, not an LLM classification, and are approximate. Summary types are batch, vendors, market, or companies. Existing stored chat contents are unchanged; analytics receives categories only. The legacy `/api/chat` endpoint retains its existing usage log and is outside this Copilot event funnel.

A question may cause multiple assistant runs because tools hand control back to the model. For question completion, count distinct `question_id` with an `assistant_run_completed` event whose `outcome` is `answer`; do not divide total run completions by question count. Durations measure individual runs, not the full user-turn latency.

## Build the first dashboard

In **Product analytics**, save these insights to a dashboard named **YC Search usage**:

| Insight | Configuration |
| --- | --- |
| Signups | Daily unique people with `user_signed_up`; also show the cumulative count from collection start. |
| Active users | Daily and weekly unique people with `user_session_started`, plus activity-specific unique users for search and questions. |
| Signup to activation | Ordered funnel: `user_signed_up` → `$pageview` filtered to `page_path=/dashboard` → `question_submitted` → `assistant_run_completed` filtered to `outcome=answer`, within seven days. |
| Anonymous preview to signup | Ordered funnel: `preview_question_submitted` → `preview_answer_completed` → `user_signed_up`, within seven days. Browser identification joins the anonymous session at signup. Cross-device visits may not join. |
| Question intent | `question_submitted`, breakdown by `intent`; separately break summaries down by `summary_type` and questions by `topics`. |
| Search quality | `search_results_loaded` filtered to `has_query=true` and `page=1`, broken down by `result_count=0` versus greater than zero. These are request outcomes, not unique search submissions. |
| Return usage | Retention: first `user_signed_up`, returning `question_submitted` or a meaningful activity event, weekly. |
| Reliability | Counts of `assistant_run_failed`, `search_failed`, and `preview_answer_failed`, shown separately. |

Filter out your owner Clerk ID for customer usage. Also exclude events with `is_test=true`; `analytics_setup_verified` is a configuration smoke test, not a user action. A signup funnel measures new signups, so existing users will not enter until a historical signup is deliberately imported. No historical usage is reconstructed. Database user repair preserves signup dates and paid plans; it does not fix the upstream Clerk webhook delivery configuration.

## Disable collection

Remove `POSTHOG_PROJECT_KEY` from the web service and redeploy. This stops app event capture without altering user data or stored chats. Existing events remain in PostHog according to the project's retention settings.
