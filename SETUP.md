# Getting BookitCMS running — step by step

Written for someone who doesn't work in a terminal day to day. Every command is
copy-paste. Nothing here can damage anything: you're creating a brand-new, free,
empty Sanity project that's separate from the studio you already have.

**Time:** about 25 minutes, most of it waiting for downloads.

**End result:** a URL like `https://bookit-cms-staging.sanity.studio` that you and
your team can log into and click around.

---

## The fast way

Steps 1–9 below are automated. Do **Step 1** (install Node) and **Step 2** (create
the Sanity project), then from the `superlogic-cms` folder run:

**Mac:**
```bash
bash setup.sh
```

**Windows:**
```powershell
powershell -ExecutionPolicy Bypass -File setup.ps1
```

It checks your Node version, asks for your Project ID and token, installs
everything, seeds the tenants and imports the tokens — then tells you the two
commands to run next. Safe to re-run if something goes wrong partway.

The rest of this document is the same thing done by hand, plus troubleshooting.
Read on if the script fails, or if you'd rather see each step.

---

## Before you start

You need two things, and you'll collect them as you go:

| What | Where it comes from | Looks like |
| --- | --- | --- |
| Project ID | Step 2 | `a1b2c3d4` |
| API token | Step 6 | `sk...` (a long string) |

Keep them in a note as you go. The token is a password — don't paste it into
email or Slack.

---

## Step 1 — Install Node.js

Node is the thing that runs the studio. You probably don't have it.

1. Go to **<https://nodejs.org>**
2. Download the **LTS** version (the recommended one, usually the left-hand button)
3. Run the installer, accept the defaults, click through to the end

To check it worked, open your terminal:

- **Mac** — press `Cmd + Space`, type `Terminal`, press Enter
- **Windows** — press the Start key, type `PowerShell`, press Enter

Paste this and press Enter:

```bash
node --version
```

You should see something like `v22.11.0` or higher. **The first number must be 22
or above.** If it's lower, or you get "command not found", the install didn't take —
restart the terminal and try again.

---

## Step 2 — Create the Sanity project

1. Go to **<https://sanity.io/manage>** and sign in (or sign up — it's free)
2. Click **Create new project**
3. Name it `BookitCMS Staging`
4. When it asks about a dataset, take the default: **production**, and leave it
   **public** for now — that's fine for staging and saves a step later
5. On the project page, find the **Project ID** near the top. It's a short string
   like `a1b2c3d4`. **Copy it into your note.**

> Deliberately a separate project from your existing studio. If the content model
> changes — and it will, once you see it — you can delete this and start again
> without touching anything real.

---

## Step 3 — Unzip the code

Unzip `superlogic-cms.zip` somewhere you'll find again. Your **Documents** folder
is fine. Avoid Downloads — things get cleaned out of there.

You should end up with a folder called `superlogic-cms` containing `README.md`,
`package.json`, and folders like `schemas` and `lib`.

---

## Step 4 — Point the terminal at that folder

In the terminal, type `cd ` (with a space after it), then **drag the
`superlogic-cms` folder from Finder/Explorer onto the terminal window** and press
Enter. That fills in the path for you.

Check you're in the right place:

```bash
ls
```

You should see `package.json`, `README.md`, `schemas`, `lib`. If you don't, you're
in the wrong folder — try the drag again.

---

## Step 5 — Add your Project ID

Paste this, but **replace `PASTE_YOUR_PROJECT_ID_HERE`** with the ID from Step 2:

**Mac:**
```bash
cat > .env.local <<'EOF'
SANITY_STUDIO_PROJECT_ID=PASTE_YOUR_PROJECT_ID_HERE
SANITY_STUDIO_DATASET=production
EOF
```

**Windows PowerShell:**
```powershell
@"
SANITY_STUDIO_PROJECT_ID=PASTE_YOUR_PROJECT_ID_HERE
SANITY_STUDIO_DATASET=production
"@ | Out-File -Encoding utf8 .env.local
```

---

## Step 6 — Get an API token

This lets the setup scripts write the tenants and tokens into your project.

1. Back on **<https://sanity.io/manage>**, open your project
2. Go to the **API** tab → **Tokens** → **Add API token**
3. Name it `setup`, choose permission **Editor**, click Save
4. **Copy the token immediately — Sanity only shows it once.**

Now add it to your `.env.local`, replacing `PASTE_YOUR_TOKEN_HERE`:

**Mac:**
```bash
echo 'SANITY_WRITE_TOKEN=PASTE_YOUR_TOKEN_HERE' >> .env.local
```

**Windows PowerShell:**
```powershell
Add-Content .env.local 'SANITY_WRITE_TOKEN=PASTE_YOUR_TOKEN_HERE'
```

> Delete this token from sanity.io/manage once you're done setting up. It's only
> needed for the seed and import steps, not for running the studio.

---

## Step 7 — Install and check

```bash
npm install
```

Takes a few minutes and prints a lot of text. Warnings are normal; red `ERR!`
lines are not.

Now run the tests — this proves the token logic works before you trust anything
it tells you:

```bash
npm test
```

You want to see `226/226 shared variables match exactly` and four sets of passing
assertions.

> These tests compare against a copy of your `superlogic-ui` repo that only exists
> on my machine, so **a few will report skipped or fail to find files on yours.**
> That's expected and harmless. If you want them fully green, clone superlogic-ui
> next to this folder and run
> `npm run tokens:manifest -- --repo ../superlogic-ui`.

---

## Step 8 — Run it locally

```bash
npm run dev
```

Wait for it to say it's ready, then open **<http://localhost:3333>** in your
browser. Sign in with the same account as Step 2.

**You should see** a left-hand menu with *Tenants*, *Universal defaults* and
*Foundation tokens*. It'll be empty — that's next.

Leave this running. To stop it later, click the terminal and press `Ctrl + C`.

---

## Step 9 — Load the data

Open a **second** terminal window (`Cmd + N` / new PowerShell) and `cd` to the same
folder as in Step 4. Then:

```bash
npm run seed
```

Creates the six tenants and the universal defaults. Then:

```bash
npm run tokens:import -- --dir ./figma-exports
```

Loads the ten brand token files — **already bundled in the zip**, nothing to
download. You'll see one line per brand.

It will say the foundation files are missing. That's expected — you sent me the
Theme · Brand exports only. Drop the four `Foundation · Breakpoint` files into
`figma-exports/foundation/` (there's a README in there naming them) and re-run to
complete the picture.

Refresh <http://localhost:3333> and you'll see the tenants populated.

---

## Step 10 — Try the thing this is all for

This is the bit worth actually testing:

1. Go to **Tenants → Bookit → Theme & style tokens**
2. Click **Validate & publish**

It should publish, and the **Compiled output** tab will fill with generated CSS.

Now try one that should fail. The `actai` brand file aliases into the wrong brand
in Figma — if you create a tenant for it and import that file, publishing is
blocked with an explanation naming the exact token.

You can also see the compatibility layer working: on Bookit's compiled output,
**Compatibility aliases emitted** should read **9**. Those are the old variable
names still used by the frontend, kept alive while the UX work lands.

---

## Step 11 — Put it online

Stop the dev server (`Ctrl + C`), then:

```bash
npx sanity login
```

Opens a browser to sign in. Then:

```bash
npx sanity deploy
```

It asks for a **hostname** — this becomes your URL. Something like
`bookit-cms-staging` gives you:

**`https://bookit-cms-staging.sanity.studio`**

Send that to whoever's reviewing. They'll need to be invited to the project first:
sanity.io/manage → your project → **Members** → **Invite**.

To push changes later, run `npx sanity deploy` again.

---

## About bookitapi.com

`*.sanity.studio` is free and right for staging. A custom domain like
`cms.bookitapi.com` needs either a **paid Sanity plan** or hosting the studio
yourself on Vercel or Netlify.

Not worth solving now. The content lives in Sanity's API regardless of where the
editing UI is served from, so moving later is a hosting change, not a migration —
nothing you enter now gets lost. Come back to it when you're closer to production
and I'll set it up.

---

## If something goes wrong

**"command not found: npm"** — Node didn't install. Redo Step 1 and open a *new*
terminal window afterwards.

**"SANITY_STUDIO_PROJECT_ID is not set"** — `.env.local` is missing, in the wrong
folder, or the ID didn't get pasted in. Run `cat .env.local` (Mac) or
`Get-Content .env.local` (Windows) and check it looks right.

**Blank screen or "Not authorized" at localhost:3333** — the project needs to allow
your browser. Go to sanity.io/manage → your project → **API** → **CORS origins** →
**Add origin** → `http://localhost:3333`, tick **Allow credentials**.

**"Unauthorized" from `npm run seed`** — the token is missing, mistyped, or wasn't
created with **Editor** permission. Make a fresh one.

**Port 3333 already in use** — something else is on that port. Run
`npm run dev -- --port 3334` and use <http://localhost:3334>.

**`npm test` fails on file paths** — expected, see the note in Step 7.

If you get stuck, paste me the terminal output — including the command you ran —
and I'll tell you what it means.
