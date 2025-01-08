import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ArrowUp, ArrowDown, Activity } from "lucide-react";

interface ConnectionMetrics {
  latency: number;
  errors: number;
  successRate: number;
  timestamp: number;
}

interface ReliabilityAlert {
  severity: 'high' | 'medium';
  reason: string;
  timestamp: number;
  metrics: {
    errorRate: number;
    latencyTrend: number;
  };
}

export function ReliabilityMetrics() {
  const [metrics, setMetrics] = useState<ConnectionMetrics[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Create WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

    socket.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'RELIABILITY_METRICS':
          setMetrics(data.payload);
          break;
        case 'RELIABILITY_ALERT':
          const alert = data.payload as ReliabilityAlert;
          toast({
            title: `Connection ${alert.severity === 'high' ? 'Alert' : 'Warning'}`,
            description: alert.reason,
            variant: alert.severity === 'high' ? 'destructive' : 'default',
          });
          break;
      }
    });

    setWs(socket);

    return () => {
      socket.close();
    };
  }, []);

  // Calculate current health metrics
  const currentMetrics = metrics[metrics.length - 1];
  const previousMetrics = metrics[metrics.length - 2];
  
  const latencyTrend = currentMetrics && previousMetrics
    ? ((currentMetrics.latency - previousMetrics.latency) / previousMetrics.latency) * 100
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Connection Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        {currentMetrics ? (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Success Rate</span>
                <span className="text-sm text-muted-foreground">
                  {(currentMetrics.successRate * 100).toFixed(1)}%
                </span>
              </div>
              <Progress value={currentMetrics.successRate * 100} />
            </div>

            <div className="flex justify-between items-center">
              <div>
                <span className="text-sm font-medium">Latency</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">
                    {currentMetrics.latency}ms
                  </span>
                  {latencyTrend !== 0 && (
                    <span
                      className={`flex items-center text-sm ${
                        latencyTrend > 0 ? 'text-destructive' : 'text-green-500'
                      }`}
                    >
                      {latencyTrend > 0 ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )}
                      {Math.abs(latencyTrend).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            {currentMetrics.errors > 0 && (
              <div className="text-sm text-destructive">
                Recent Errors: {currentMetrics.errors}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Gathering connection metrics...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
