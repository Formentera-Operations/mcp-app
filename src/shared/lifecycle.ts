import { App } from '@modelcontextprotocol/ext-apps';
import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { handleHostContextChanged, initThemeAfterConnect } from './theme.ts';

export interface ViewCallbacks {
  onToolInput?: (args: Record<string, unknown>) => void;
  onToolInputPartial?: (args: Record<string, unknown>) => void;
  onToolResult?: (structuredContent: Record<string, unknown>) => void;
  onToolCancelled?: (reason: string) => void;
  onPause?: () => void;
  onResume?: () => void;
  onTeardown?: () => void;
}

export function createViewApp(
  name: string,
  version: string,
  callbacks: ViewCallbacks,
): App {
  const app = new App({ name, version });

  // --- Register ALL handlers BEFORE connect() ---

  let currentDisplayMode: 'inline' | 'fullscreen' = 'inline';

  app.onhostcontextchanged = (ctx: McpUiHostContext) => {
    handleHostContextChanged(ctx);

    // Fullscreen button visibility
    if (ctx.availableDisplayModes !== undefined) {
      const canFullscreen = ctx.availableDisplayModes.includes('fullscreen');
      const btn = document.getElementById('fullscreen-btn');
      if (btn) btn.style.display = canFullscreen ? 'block' : 'none';
    }

    // Track display mode (validate — SDK may add new modes like 'pip')
    if (ctx.displayMode === 'inline' || ctx.displayMode === 'fullscreen') {
      currentDisplayMode = ctx.displayMode;
      document.querySelector('.main')?.classList.toggle(
        'fullscreen',
        currentDisplayMode === 'fullscreen',
      );
    }
  };

  // Streaming partial input (debounced via requestAnimationFrame)
  let partialRafId = 0;
  if (callbacks.onToolInputPartial) {
    app.ontoolinputpartial = (params) => {
      const args = params.arguments;
      if (!args) return;
      cancelAnimationFrame(partialRafId);
      partialRafId = requestAnimationFrame(() => {
        callbacks.onToolInputPartial!(args as Record<string, unknown>);
      });
    };
  }

  // Complete input (tool args finalized, before server handler runs)
  if (callbacks.onToolInput) {
    app.ontoolinput = (params) => {
      cancelAnimationFrame(partialRafId);
      if (params.arguments) {
        callbacks.onToolInput!(params.arguments as Record<string, unknown>);
      }
    };
  }

  // Final result (after server handler returns)
  if (callbacks.onToolResult) {
    app.ontoolresult = (result) => {
      const sc = result.structuredContent;
      if (sc && typeof sc === 'object') {
        callbacks.onToolResult!(sc as Record<string, unknown>);
      }
    };
  }

  // Cancellation
  app.ontoolcancelled = (params) => {
    cancelAnimationFrame(partialRafId);
    callbacks.onToolCancelled?.(params.reason ?? 'unknown');
  };

  // Error + teardown
  app.onerror = (err) => {
    app.sendLog({ level: 'error', data: String(err) });
  };
  app.onteardown = async () => {
    callbacks.onTeardown?.();
    return {};
  };

  // --- Visibility-based pause/resume ---
  const mainEl = document.querySelector('.main');
  if (mainEl && (callbacks.onPause || callbacks.onResume)) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          callbacks.onResume?.();
        } else {
          callbacks.onPause?.();
        }
      }
    });
    observer.observe(mainEl);
  }

  // --- Fullscreen button ---
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  if (fullscreenBtn) {
    fullscreenBtn.style.display = 'none';
    fullscreenBtn.addEventListener('click', async () => {
      const newMode = currentDisplayMode === 'fullscreen' ? 'inline' : 'fullscreen';
      try {
        const result = await app.requestDisplayMode({ mode: newMode });
        if (result.mode === 'inline' || result.mode === 'fullscreen') {
          currentDisplayMode = result.mode;
        }
        document.querySelector('.main')?.classList.toggle(
          'fullscreen',
          currentDisplayMode === 'fullscreen',
        );
      } catch {
        // Host rejected the mode change
      }
    });
  }

  // --- Escape key exits fullscreen ---
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && currentDisplayMode === 'fullscreen') {
      fullscreenBtn?.click();
    }
  });

  // --- Connect, then apply initial host context ---
  app.connect()
    .then(() => initThemeAfterConnect(app))
    .catch((err) => {
      const el = document.getElementById('error-msg');
      if (el) {
        el.textContent = `Connection failed: ${String(err)}`;
        el.style.display = 'flex';
      }
    });

  return app;
}
