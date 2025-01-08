import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import type { Express } from 'express';
import { db } from '@db';
import { notifications } from '@db/schema';
import { eq } from 'drizzle-orm';
import { reliabilityMonitor } from './services/reliability';

export interface WebSocketMessage {
  type: string;
  payload: any;
}

// Store active WebSocket connections with their user IDs
const clients = new Map<number, WebSocket>();

export function setupWebSocket(server: Server, app: Express) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Setup reliability monitor listener
  reliabilityMonitor.on('reliabilityAlert', (alert) => {
    // Broadcast reliability alerts to all connected clients
    const message: WebSocketMessage = {
      type: 'RELIABILITY_ALERT',
      payload: alert
    };

    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  });

  wss.on('connection', async (ws, req) => {
    // Get user ID from session
    const userId = (req as any).session?.userId;
    if (!userId) {
      ws.close();
      return;
    }

    // Store the connection
    clients.set(userId, ws);

    // Send initial reliability metrics
    const metrics = reliabilityMonitor.getMetrics();
    ws.send(JSON.stringify({
      type: 'RELIABILITY_METRICS',
      payload: metrics
    }));

    // Send unread notifications
    const unreadNotifications = await db.query.notifications.findMany({
      where: eq(notifications.userId, userId),
      orderBy: (notifications, { desc }) => [desc(notifications.createdAt)],
    });

    ws.send(JSON.stringify({
      type: 'NOTIFICATIONS_INIT',
      payload: unreadNotifications,
    }));

    ws.on('close', () => {
      clients.delete(userId);
    });
  });

  return {
    broadcast: (userId: number, message: WebSocketMessage) => {
      const client = clients.get(userId);
      if (client?.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    },
    broadcastToAll: (message: WebSocketMessage) => {
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      });
    },
  };
}