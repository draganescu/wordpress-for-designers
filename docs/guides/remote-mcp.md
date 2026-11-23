# Work with an AI agent on a hosted site

This guide connects an AI agent to boards on a WordPress site that lives on the internet: one you host yourself, or one a hosting company runs for you. The agent opens a board in a browser, you watch it work, and nothing reaches the site until you save it yourself.

If your site runs on your own computer in WordPress Studio, use [the Studio guide](studio.md). It is simpler.

## How it fits together

Three things talk to each other:

1. **Your site** offers a set of actions an agent may take on a board, such as "list the boards" or "change this heading".
2. **Your agent** connects to the site and asks for those actions. The connection uses MCP, a common way for AI apps to plug into other tools. You only need to know it as the name of a setting.
3. **A browser the agent controls** has the board open. This is where the work happens and where you watch it.

The third part matters most. The agent does not change your site behind the scenes. It works on a board that is open on screen, exactly as a second designer would, and its changes wait for your approval.

## A few words you will meet

| Word | What it means here |
|---|---|
| Plugin | An add-on you install into WordPress. It arrives as a `.zip` file. |
| Board | The canvas this plugin adds to WordPress. |
| Agent | The AI assistant you chat with. |
| MCP | The plug that lets an AI app use tools on another system, here your site. |
| MCP address | The web address your agent connects to. Some apps call it a server URL or a connector URL. |
| Administrator | A WordPress account that may change the site's design. |

## Before you start

- A WordPress site, **version 7.2 or later**, with a block theme, reachable at an `https://` address.
- An **administrator** account on that site. The agent acts as that account, so it can do what the account can do and no more.
- An AI agent app that can do two things: connect to an MCP address, and control a browser. This setup has been tried with the Claude desktop app.
- Three plugins:
    - [wordpress-for-designers.zip](https://github.com/draganescu/wordpress-for-designers/releases/latest/download/wordpress-for-designers.zip), the plugin itself.
    - [wfd-abilities.zip](https://github.com/draganescu/wordpress-for-designers/releases/latest/download/wfd-abilities.zip), which offers the board's actions to agents.
    - The [MCP Adapter](https://github.com/WordPress/mcp-adapter/releases) plugin, made by the WordPress project, which carries those actions over MCP.

## Set it up

### 1. Install the three plugins

1. Sign in to your site's dashboard. Its address is your site's address followed by `/wp-admin`.
2. Go to **Plugins**, then **Add Plugin**, then **Upload Plugin**.
3. Choose a zip, press **Install Now**, then **Activate Plugin**.
4. Repeat for the other two.

A new item called **Designer** now sits in the dashboard's menu. Open it and make a board with **Add board**, so the agent has somewhere to work.

### 2. Find your MCP address

It is your site's address followed by a fixed ending:

```text
https://your-site.example/wp-json/mcp/mcp-adapter-default-server
```

Replace `your-site.example` with your own address.

### 3. Connect your agent

In your agent app, add a new connector (some apps say "MCP server" or "integration") and paste the MCP address.

The app then needs to prove to your site who it is. How that goes depends on your site:

- **A sign-in window opens.** Sign in with your administrator account and approve. This is the easiest route, and it is there when your site or host has set it up.
- **No sign-in window.** Use an application password. This is a separate password WordPress makes for one app, so you never hand over your real one. In the dashboard go to **Users**, then **Profile**, scroll to **Application Passwords**, type a name such as "Design agent", and press **Add Application Password**. Copy the password it shows, since it is shown once. Enter it in your agent app together with your username, where the app asks for sign-in details for the connector. Your agent app's help pages say where that is.

You can remove an application password from the same screen at any time. The agent loses access the moment you do.

### 4. Sign in to the site in the agent's browser

The connector's sign-in and the browser's sign-in are separate. In the browser your agent controls, open your site's dashboard and sign in with **the same account** you used in step 3. The agent can only work on boards opened by the account it is connected as.

### 5. Say hello

Ask your agent:

> List the boards on my site and open the first one.

The agent names your boards and opens one in its browser. The board's header reads **Agent connected**. You are set up.

## Working together

**Ask in chat.** Describe what you want, as you would to a colleague:

> Add the Home page at desktop and phone width.

> Shorten the heading on the About page.

> Make a new board called Spring campaign.

**Keep the board in view.** The agent works on the board only while its browser tab is open and visible. If another window covers it or you switch tabs, the agent stops and tells you the board is not in view.

**Watch it happen.** An artboard shows **Agent working** while the agent changes it. Afterwards its label reads **Changed by agent**.

**You decide what is kept.** The agent never saves, and it is told not to press Save for you either. Every change waits under **Review changes**, marked as yours or the agent's. Save the ones you like and discard the rest. The one exception is a new board: when you ask for one, it is made right away.

One thing to know: pages have drafts, but templates and template parts do not. A saved change to a template shows on the live site straight away. The agent is told to warn you when that applies.

## Staying safe

- The agent can do on a board what your account can do in WordPress's own editor. Connect it with an account you would trust a colleague with.
- Nothing it changes is live until you save it in Review. Read the list before you save, as you would a colleague's work.
- To cut the agent off, remove the connector in your agent app, or delete its application password in WordPress.
- A live site is public. Try this on a staging copy first if your host gives you one.

## If something does not work

| What you see | What to do |
|---|---|
| The agent finds no board actions | Check that all three plugins are active, and that the account you connected with is an administrator. |
| The agent says no board is listening | Ask it to open a board. If one is open, bring its tab to the front, or reload it once. |
| The board shows a sign-in page in the agent's browser | Sign in there with the same account as the connector (step 4). |
| The agent is connected but the board never reads "Agent connected" | The browser and the connector are probably signed in as two different accounts. Use one account for both. |
| The agent says several boards are open | Close the ones you are not using, or tell the agent which board you mean. |
| "Designing needs more space" | Widen the browser window. The board needs about 1180 pixels of width. |
| The connector cannot reach the site | Check the MCP address for typos and that it starts with `https://`. Some hosts block this kind of address; ask your host's support to allow `/wp-json/mcp/`. |
