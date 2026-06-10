# The Trail

A family's reading journey.

This folder is the entire app. A single `index.html` runs the catalogue, the family state, the filters, and the add-a-book flow. The shared state lives in Firebase Firestore, signed in anonymously, so anyone with the link can read and write without managing accounts. Below is the deployment, end to end. Read it once before you start; it's shorter than it looks.

## What's in the box

| File | Role |
| --- | --- |
| `index.html` | The whole app. Open it in a browser to run it; open it in an editor to configure it. |
| `firestore.rules` | The security rules. Paste them into Firebase so only signed-in clients can read or write the family's documents. |
| `worker.js` | Optional. A Cloudflare Worker that proxies the AI add-book step so the family doesn't need to copy and paste from Claude. Skip this for now; the manual fallback works on day one. |
| `README.md` | This file. |

## How long this takes

About twenty minutes the first time. Five if you've done it before.

## 1. Create the Firebase project

1. Go to `https://console.firebase.google.com` and click **Add project**.
2. Name it something like `the-trail`. Disable Google Analytics; the family doesn't need it.
3. When the project is ready, open it.

## 2. Turn on the two services The Trail needs

**Anonymous Authentication.**

1. In the left rail, **Build → Authentication**, then **Get started**.
2. On the **Sign-in method** tab, click **Anonymous**, toggle **Enable**, and save.

**Firestore Database.**

1. In the left rail, **Build → Firestore Database**, then **Create database**.
2. Pick a location close to you (for Italy, `eur3 (europe-west)` is the right one).
3. Start in **production mode**. We'll write the rules in the next step.

## 3. Paste the security rules

1. In Firestore, open the **Rules** tab.
2. Replace whatever is there with the contents of `firestore.rules` (in this folder).
3. Click **Publish**.

These rules say: anyone signed in can read or write inside `families/{familyId}`. Anonymous Auth signs everyone in automatically, so in practice anyone with the URL has access. That is what we want for a family app; we don't want the family typing passwords. If you ever need to lock a particular family down further, the rules are the place to do it.

## 4. Grab the web config

1. In Firebase, click the **gear icon → Project settings**.
2. Scroll to **Your apps**, click the `</>` web-app icon, and register an app called something like `the-trail-web`. Skip the hosting offer.
3. Firebase will show you a `firebaseConfig` block that looks like this:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "the-trail.firebaseapp.com",
  projectId: "the-trail",
  storageBucket: "the-trail.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef..."
};
```

4. Open `index.html` in your editor. Near the top there's a clearly marked block:

```html
<!-- FIREBASE CONFIG  ·  edit this block before deploying -->
<script>
  window.FIREBASE_CONFIG = {
    apiKey: "",
    authDomain: "",
    ...
  };
</script>
```

Paste your values in. The `apiKey` field is the one the app checks for; without it the setup screen will appear instead of the trail.

You can safely commit this config to a public GitHub repository. The Firebase web config is not a secret; security is enforced by Firestore rules, not by hiding the API key. This is by design.

## 5. Put it on GitHub Pages

```bash
# in this folder
git init
git add index.html README.md firestore.rules worker.js
git commit -m "The Trail, ready to walk"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/the-trail.git
git push -u origin main
```

Then in the repository on github.com:

1. **Settings → Pages**.
2. **Source**: `Deploy from a branch`.
3. **Branch**: `main`, folder `/ (root)`.
4. Save.

A minute later the page will be live at `https://YOUR-USERNAME.github.io/the-trail/`. Open it on your phone and add your name. Send the link to the family.

## 6. Multiple families on one deployment

The app reads a `?family=` parameter from the URL. So:

- `https://YOUR-USERNAME.github.io/the-trail/` is the default family.
- `https://YOUR-USERNAME.github.io/the-trail/?family=smith` is a separate, isolated family with its own readers, reads, stars, and added books.
- `?family=` accepts letters, numbers, dashes and underscores, up to 60 characters. Anything else is stripped.

You don't need to configure this in Firebase; each family creates itself the moment someone first visits its URL.

## The add-a-book step

When a family member adds a new book, The Trail asks Claude to write the catalogue entry in the house voice. This needs an API key, which we don't want shipped to every reader's browser. Two options:

**Manual fallback (default).** No setup. The app shows the family member the prompt with a copy button, and a paste field to drop the reply back in. A trip to the Claude tab, about a minute. This works out of the box.

**Cloudflare Worker (optional, recommended).** A small serverless function holding the API key, callable from the browser. The family member doesn't see Claude at all; the entry just appears. To set it up:

1. Sign up for a free Cloudflare account.
2. Go to **Workers & Pages → Create → Create Worker**.
3. Replace the default code with the contents of `worker.js` in this folder.
4. In **Settings → Variables**, add `ANTHROPIC_API_KEY` as a secret with your key.
5. Deploy. Copy the worker's URL.
6. In `index.html`, find `window.TRAIL_WRITER_URL` near the top and paste the URL between the quotes.
7. Commit and push. The next time someone adds a book, the worker writes the entry.

The manual fallback is still there if the worker is unreachable, so the family flow never breaks.

## Editing the catalogue

The 198 books, the 14 family members, and their starred picks all live inside `index.html` as embedded data, not in Firestore. This is on purpose: it keeps the trail editorial, version-controlled, and offline-capable. Books added through the app are stored in Firestore and join the embedded list at runtime.

If you want to amend a description, retire a tag, or add a canonical title yourself, edit the constants near the top of the React block in `index.html`. The data shape for each book is straightforward and visible in the file.

## A note on cost

For a family-sized deployment, Firebase's free tier covers Firestore reads, writes, and Anonymous Auth comfortably. The free Firebase project has daily quotas of around fifty thousand reads and twenty thousand writes; the family will use a tiny fraction of either. GitHub Pages is free for public repositories. The Cloudflare Worker, if you set it up, also runs on the free tier (a hundred thousand requests per day).

## Troubleshooting

**"Almost ready" appears instead of the trail.** The Firebase config is missing or its `apiKey` is empty. Step 4.

**"Something is off with Firebase" appears.** Usually one of three things: Anonymous sign-in is not enabled (step 2), the Firestore database wasn't created (step 2), or the security rules haven't been published (step 3). The screen names the family ID it tried; check it matches.

**The shelf shows but nothing saves.** Open the browser console. If you see `permission-denied` errors, the security rules aren't published. If you see `unauthenticated`, Anonymous sign-in isn't on.

**The page is blank for a few seconds on first load.** The first visit downloads Babel and React from the CDN, about a megabyte. Cached after that.

**A family member's name shows the wrong pastel.** Profiles are written to Firestore the first time a name is added. If two devices added the same person at the same moment, one write wins; the other can re-add to refresh. The list shows up fine either way.

That's the whole thing. Open the file, type a name in the masthead, and start walking.
