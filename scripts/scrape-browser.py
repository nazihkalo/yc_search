"""Private line-delimited JSON bridge. Never print proxy credentials/errors."""
import asyncio
import contextlib
import json
import os
import sys
from collections import OrderedDict

from playwright.async_api import async_playwright
from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator


async def main():
    contexts = OrderedDict()
    async with async_playwright() as playwright:
        # Proxy credentials arrive through the private stdin pipe, never argv.
        first = json.loads(await asyncio.to_thread(sys.stdin.readline))
        proxy = first.get("proxy")
        browser = await playwright.chromium.launch(headless=True, proxy=proxy)
        # Keep the installed browser's platform/version rather than a stale
        # hardcoded Chrome release. Normalize only its headless product marker.
        identity_context = await browser.new_context()
        identity_page = await identity_context.new_page()
        browser_identity = (await identity_page.evaluate("navigator.userAgent")).replace("HeadlessChrome/", "Chrome/")
        await identity_context.close()
        generator = DefaultMarkdownGenerator(options={"ignore_images": True})
        request = first
        while request:
            response = {"id": request["id"], "success": False, "bytes": 0, "workerPid": os.getpid(), "browserVersion": browser.version}
            page = None
            tasks = set()
            finished = None
            try:
                key = request["context"]
                if key not in contexts:
                    if len(contexts) >= 8:
                        _, old = contexts.popitem(last=False)
                        await old.close()
                    contexts[key] = await browser.new_context(user_agent=browser_identity, viewport={"width": 1440, "height": 1000}, service_workers="block", accept_downloads=False)
                    async def route_handler(route):
                        if route.request.resource_type in ("image", "media", "font"):
                            await route.abort()
                        else:
                            await route.continue_()
                    await contexts[key].route("**/*", route_handler)
                context = contexts[key]
                contexts.move_to_end(key)
                page = await context.new_page()
                maximum = request.get("maxBytes", 20_000_000)
                async def count_transfer(req):
                    try:
                        sizes = await req.sizes()
                        response["bytes"] += sum(max(0, sizes.get(k, 0)) for k in ("requestBodySize", "requestHeadersSize", "responseBodySize", "responseHeadersSize"))
                        if response["bytes"] > maximum:
                            response["budgetExceeded"] = True
                            await page.close()
                    except Exception:
                        pass
                def finished(req):
                    task = asyncio.create_task(count_transfer(req))
                    tasks.add(task)
                    task.add_done_callback(tasks.discard)
                page.on("requestfinished", finished)
                navigation = await page.goto(request["url"], wait_until="domcontentloaded", timeout=request["timeout"])
                response["status"] = navigation.status if navigation else None
                response["finalUrl"] = page.url
                response["retryAfter"] = (await navigation.all_headers()).get("retry-after") if navigation else None
                if response["status"] and response["status"] >= 400:
                    response["error"] = "Publisher HTTP " + str(response["status"])
                else:
                    try:
                        await page.wait_for_function("document.body && document.body.innerText.trim().length > 400", timeout=min(8000, request["timeout"]))
                    except Exception:
                        pass
                    await page.wait_for_timeout(1000)
                    for _ in range(2):
                        await page.mouse.wheel(0, 1600)
                        await page.wait_for_timeout(350)
                    response["title"] = await page.title()
                    response["text"] = await page.locator("body").inner_text(timeout=5000)
                    # Do not mistake an HTTP-200 challenge/auth wall for content.
                    first_text = response["text"][:1200].lower()
                    if any(marker in first_text for marker in ("verify you are human", "checking your browser", "access denied", "just a moment...")):
                        response["error"] = "Publisher challenge page"
                    elif any(marker in page.url for marker in ("/authwall", "/checkpoint/", "/login")):
                        response["error"] = "Publisher requires login"
                    else:
                        response["links"] = await page.eval_on_selector_all("a[href]", "els => els.slice(0, 500).map(a => ({text:a.innerText || a.textContent || '',href:a.href}))")
                        html = await page.content()
                        if len(html) > 2_000_000:
                            response["error"] = "Publisher HTML exceeds budget"
                        else:
                            with contextlib.redirect_stdout(sys.stderr):
                                response["markdown"] = generator.generate_markdown(html, base_url=page.url, citations=False).raw_markdown
                            response["success"] = True
                if tasks:
                    await asyncio.gather(*list(tasks), return_exceptions=True)
                if response.get("budgetExceeded"):
                    response["success"] = False
                    response["error"] = "Browser transfer exceeded request allowance"
            except Exception as exc:
                response["error"] = "Browser navigation failed: " + type(exc).__name__
            finally:
                if page:
                    if finished:
                        page.remove_listener("requestfinished", finished)
                    await page.close()
                if tasks:
                    await asyncio.gather(*list(tasks), return_exceptions=True)
            # Output bound prevents accidental giant pages from filling the pipe.
            if len(json.dumps(response)) > 8_000_000:
                response = {"id": request["id"], "success": False, "error": "Browser output exceeds budget", "bytes": response["bytes"]}
            print(json.dumps(response), flush=True)
            line = await asyncio.to_thread(sys.stdin.readline)
            request = json.loads(line) if line else None
        await browser.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception:
        # Unexpected startup failures stay generic to avoid leaking proxy auth.
        print(json.dumps({"success": False, "error": "Browser worker startup failed"}), flush=True)
        sys.exit(1)
