import {
  applyDocumentTheme,
  applyHostStyleVariables,
  applyHostFonts,
} from '@modelcontextprotocol/ext-apps';
import type { App, McpUiHostContext } from '@modelcontextprotocol/ext-apps';

function applySafeAreaInsets(
  insets: { top: number; right: number; bottom: number; left: number },
): void {
  const main = document.querySelector('.main') as HTMLElement | null;
  if (!main) return;
  main.style.paddingTop = `${insets.top}px`;
  main.style.paddingRight = `${insets.right}px`;
  main.style.paddingBottom = `${insets.bottom}px`;
  main.style.paddingLeft = `${insets.left}px`;
}

export function handleHostContextChanged(ctx: McpUiHostContext): void {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
  if (ctx.safeAreaInsets) applySafeAreaInsets(ctx.safeAreaInsets);
}

export function initThemeAfterConnect(app: App): void {
  const ctx = app.getHostContext();
  if (ctx) handleHostContextChanged(ctx);
}
