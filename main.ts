import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from './server.js';

async function startStdioServer(): Promise<void> {
  await createServer().connect(new StdioServerTransport());
}

async function startHttpServer(): Promise<void> {
  const port = parseInt(process.env.PORT ?? '3001', 10);

  const app = createMcpExpressApp({ host: '0.0.0.0' });
  app.use(cors());

  app.all('/mcp', async (req: Request, res: Response) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on('close', () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  const httpServer = app.listen(port, () => {
    console.error(`Formentera Viz MCP server listening on http://localhost:${port}/mcp`);
  });

  const shutdown = () => {
    console.error('\nShutting down...');
    httpServer.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function main(): Promise<void> {
  if (process.argv.includes('--stdio')) {
    await startStdioServer();
  } else {
    await startHttpServer();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
