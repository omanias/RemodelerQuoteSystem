import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data: any;
}

export function NotificationsMenu() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
  });

  useEffect(() => {
    // Connect to WebSocket
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    const websocket = new WebSocket(wsUrl);

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'NEW_NOTIFICATION') {
        // Invalidate notifications query to trigger a refetch
        queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      }
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, [queryClient]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (notificationIds: number[]) => {
    await fetch('/api/notifications/mark-read', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notificationIds }),
    });
    queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-medium text-white flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[380px]">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-sm font-semibold">Notifications</h2>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAsRead(notifications.filter(n => !n.read).map(n => n.id))}
            >
              Mark all as read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="grid gap-1">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  className={`w-full text-left p-4 hover:bg-accent ${
                    !notification.read ? 'bg-accent/50' : ''
                  }`}
                  onClick={() => !notification.read && markAsRead([notification.id])}
                >
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium leading-none">
                        {notification.title}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
