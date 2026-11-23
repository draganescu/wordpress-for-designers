# Work with an AI agent on your computer, with WordPress Studio

This guide sets up a site on your own computer where you and an AI agent design on the same board. You ask for a change in plain words, the agent makes it on the board while you watch, and nothing reaches the site until you save it yourself.

You do not need to know WordPress well, and you will not write any code.

## What you will end up with

- A WordPress site that runs on your computer, in the WordPress Studio app.
- A board open in Studio's preview, next to Studio's chat.
- An agent (Studio's own, called Studio Code) that can read the board and change it when you ask.
- The Annotate tool: click a heading, an image or a colour on the board, write a note such as "make this shorter", and send it to the agent.

## A few words you will meet

| Word | What it means here |
|---|---|
| Plugin | An add-on you install into WordPress. It arrives as a `.zip` file. You never need to unzip it. |
| Board | The canvas this plugin adds to WordPress. |
| Artboard | One frame on the board. It shows a real page, template or pattern of your site. |
| Agent | The AI assistant you chat with. It works on the board for you. |
| Block theme | A modern kind of WordPress theme. The plugin needs one. New Studio sites come with one. |

## Before you start

- [WordPress Studio](https://developer.wordpress.com/studio/), the desktop app. Annotate exists only in the desktop app.
- A site in Studio that runs **WordPress 7.2 or later**. Studio lets you pick the version when you add a site.
- Two files from the [latest release](https://github.com/draganescu/wordpress-for-designers/releases/latest):
    - [wordpress-for-designers.zip](https://github.com/draganescu/wordpress-for-designers/releases/latest/download/wordpress-for-designers.zip), the plugin itself.
    - [wfd-studio.zip](https://github.com/draganescu/wordpress-for-designers/releases/latest/download/wfd-studio.zip), a small helper that makes Annotate work on boards.

## Set it up

### 1. Make a site in Studio

Open Studio and add a site. Any name will do. When it is ready, start it.

### 2. Install the two plugins

1. In Studio, open the site's **WP Admin**. This is the WordPress dashboard, the place where a site is managed.
2. Go to **Plugins**, then **Add Plugin**, then **Upload Plugin**.
3. Choose `wordpress-for-designers.zip`, press **Install Now**, then **Activate Plugin**.
4. Do the same again with `wfd-studio.zip`.

A new item called **Designer** now sits in the dashboard's menu.

### 3. Tell Studio's agent that boards exist

Studio's agent does not look for plugins on its own. You tell it once, and it remembers for every site.

1. Open Studio's **Settings**.
2. Find the **global instructions** for Studio Code. These are notes the agent reads before every chat.
3. Add this line, exactly as it is:

```text
On a site that has the WordPress for Designers plugin, when a task is about a board, an artboard or the Designer screen, run `wp wfd tools` first and follow what it prints.
```

That line points the agent at the plugin's own instructions, so there is nothing else to teach it.

### 4. Open a board

1. In the dashboard, go to **Designer**, then **Add board**. Or open a board you already have.
2. Keep the board open in Studio's preview while you work. The agent works on the board that is open; it cannot work on a closed one.

The board needs room. If you see "Designing needs more space", make the Studio window or the preview wider.

### 5. Say hello

In Studio's chat, ask:

> What is on this board?

The agent looks at the board and lists what it finds. The board's header now reads **Agent connected**. You are set up.

## Working together

**Ask in chat.** Describe what you want, as you would to a colleague:

> Add the About page to the board at desktop and phone width.

> Make the heading on the Home page shorter and friendlier.

> Try a warmer background colour across the site.

**Point with Annotate.** Turn on Annotate in Studio, click something on the board, write a note, and send it. You can click an artboard, a single block inside one, a note, or a colour in the Styles panel. The agent knows exactly which thing you clicked. While Annotate is on, the header reads **Annotating**, and clicks do not move or edit anything.

**Watch it happen.** An artboard shows **Agent working** while the agent changes it. Afterwards its label reads **Changed by agent**.

**You decide what is kept.** The agent never saves. Every change waits under **Review changes**, where each one is marked as yours or the agent's. Save the ones you like and discard the rest.

One thing to know: pages have drafts, but templates and template parts do not. A saved change to a template shows on the site straight away. The agent is told to warn you when that applies.

## If something does not work

| What you see | What to do |
|---|---|
| The agent says no board is listening | Open a board in Studio's preview. If one is already open, reload it once. |
| The agent does not seem to know about boards | Check that the line from step 3 is in Studio's global instructions, then start a new chat. |
| Annotate selects the whole artboard, not the thing inside it | Check that the Studio adapter plugin (`wfd-studio.zip`) is active under Plugins. |
| "Designing needs more space" | Widen the window. The board needs about 1180 pixels of width. |
| There is no Designer menu | Check that the site runs WordPress 7.2 or later and uses a block theme, and that the plugin is active. |
| The agent says several boards are open | Close the boards you are not using, or tell the agent which one you mean by name. |

## Next

To work the same way on a site that is on the internet, with an agent that is not on your computer, see [Work with an AI agent on a hosted site](remote-mcp.md).
