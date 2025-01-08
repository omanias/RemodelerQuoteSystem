import { EventEmitter } from 'events';
import { WebSocket } from 'ws';

interface ConnectionMetrics {
  latency: number;
  errors: number;
  successRate: number;
  timestamp: number;
}

export class ReliabilityMonitor extends EventEmitter {
  private metrics: ConnectionMetrics[] = [];
  private readonly MAX_METRICS = 100; // Keep last 100 measurements
  private readonly PREDICTION_THRESHOLD = 0.8;
  private readonly ERROR_THRESHOLD = 3;

  constructor() {
    super();
    this.startMonitoring();
  }

  private startMonitoring() {
    setInterval(() => {
      this.measureConnectionHealth();
    }, 30000); // Check every 30 seconds
  }

  private async measureConnectionHealth() {
    const startTime = Date.now();
    try {
      // Measure API endpoint health
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      const endTime = Date.now();
      const latency = endTime - startTime;

      const metric: ConnectionMetrics = {
        latency,
        errors: response.ok ? 0 : 1,
        successRate: response.ok ? 1 : 0,
        timestamp: Date.now()
      };

      this.addMetric(metric);
      this.analyzeTrends();
    } catch (error) {
      const metric: ConnectionMetrics = {
        latency: -1,
        errors: 1,
        successRate: 0,
        timestamp: Date.now()
      };
      this.addMetric(metric);
      this.analyzeTrends();
    }
  }

  private addMetric(metric: ConnectionMetrics) {
    this.metrics.push(metric);
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift();
    }
  }

  private analyzeTrends() {
    if (this.metrics.length < 3) return;

    // Calculate recent error rate
    const recentMetrics = this.metrics.slice(-3);
    const errorRate = recentMetrics.reduce((sum, m) => sum + m.errors, 0) / recentMetrics.length;

    // Calculate latency trend
    const latencyTrend = this.calculateLatencyTrend();

    // Predict potential issues
    if (errorRate > this.ERROR_THRESHOLD || latencyTrend > this.PREDICTION_THRESHOLD) {
      const severity = errorRate > this.ERROR_THRESHOLD ? 'high' : 'medium';
      const reason = errorRate > this.ERROR_THRESHOLD 
        ? 'Increased error rate detected'
        : 'Latency degradation detected';

      this.emit('reliabilityAlert', {
        severity,
        reason,
        timestamp: Date.now(),
        metrics: {
          errorRate,
          latencyTrend
        }
      });
    }
  }

  private calculateLatencyTrend(): number {
    const recentLatencies = this.metrics
      .slice(-5)
      .map(m => m.latency)
      .filter(l => l > 0);

    if (recentLatencies.length < 2) return 0;

    const average = recentLatencies.reduce((sum, l) => sum + l, 0) / recentLatencies.length;
    const trend = recentLatencies[recentLatencies.length - 1] / average;

    return trend;
  }

  public getMetrics() {
    return this.metrics;
  }
}

export const reliabilityMonitor = new ReliabilityMonitor();
