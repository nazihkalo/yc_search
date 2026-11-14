/**
 * Send a message through the CopilotChat input as if the user typed it.
 *
 * We drive the real input instead of calling `useCopilotChat().appendMessage`:
 * in @copilotkit/react-core 1.56 that hook binds to a "default" agent this app
 * doesn't define, and it retries /api/copilotkit in a tight loop.
 */
export async function sendToChat(text: string, timeoutMs = 4000): Promise<boolean> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const textarea = document.querySelector<HTMLTextAreaElement>(".copilotKitInput textarea");
    if (textarea) {
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setValue?.call(textarea, text);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));

      // Let React commit the new text so the send button becomes enabled.
      for (let i = 0; i < 20; i += 1) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const button = document.querySelector<HTMLButtonElement>('[data-test-id="copilot-chat-ready"]');
        if (button && !button.disabled) {
          button.click();
          return true;
        }
      }
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return false;
}
