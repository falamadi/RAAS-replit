'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  Globe,
  Server,
  TrendingUp,
  Users,
  Zap
} from 'lucide-react';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, { status: 'up' | 'down'; latency?: number }>;
  system: {
    memory: { percentage: number };
    cpu: { loadAverage: number[] };
  };
}

interface Metrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
    byStatusCode: Record<string, number>;
  };
  business: {
    newUsers: number;
    activeUsers: number;
    jobsPosted: number;
    applicationsSubmitted: number;
    matchesCreated: number;
    messagessSent: number;
  };
  performance: {
    databaseQueries: {
      total: number;
      slow: number;
      averageTime: number;
    };
    cacheHitRate: number;
    externalApiCalls: {
      total: number;
      failed: number;
      averageTime: number;
    };
  };
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function MetricsDashboard() {
  const [period, setPeriod] = useState<'1h' | '24h' | '7d'>('24h');

  const { data: health } = useQuery<HealthStatus>({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await apiService.get('/monitoring/health');
      return response.data;
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const { data: metrics } = useQuery<Metrics>({
    queryKey: ['metrics', period],
    queryFn: async () => {
      const response = await apiService.get('/monitoring/metrics', { params: { period } });
      return response.data;
    },
    refetchInterval: 60000 // Refresh every minute
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'up':
        return 'text-green-600 bg-green-50';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50';
      case 'unhealthy':
      case 'down':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const errorData = metrics?.errors.byStatusCode
    ? Object.entries(metrics.errors.byStatusCode).map(([code, count]) => ({
        name: code,
        value: count
      }))
    : [];

  const performanceData = [
    {
      name: 'Database',
      value: metrics?.performance.databaseQueries.averageTime || 0,
      queries: metrics?.performance.databaseQueries.total || 0
    },
    {
      name: 'Cache',
      value: metrics?.performance.cacheHitRate || 0,
      queries: 100
    },
    {
      name: 'External APIs',
      value: metrics?.performance.externalApiCalls.averageTime || 0,
      queries: metrics?.performance.externalApiCalls.total || 0
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Metrics</h2>
          <p className="text-muted-foreground">
            Real-time monitoring and performance metrics
          </p>
        </div>
        <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">Last Hour</SelectItem>
            <SelectItem value="24h">Last 24 Hours</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Health Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <span className="text-2xl font-bold">Status</span>
            <Badge className={getStatusColor(health?.status || 'unknown')}>
              {health?.status?.toUpperCase() || 'UNKNOWN'}
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(health?.services || {}).map(([service, info]) => (
              <div key={service} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  {info.status === 'up' ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="font-medium capitalize">{service}</span>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className={getStatusColor(info.status)}>
                    {info.status}
                  </Badge>
                  {info.latency && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {info.latency}ms
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Memory Usage</span>
                <span className="text-sm text-muted-foreground">
                  {health?.system.memory.percentage.toFixed(1)}%
                </span>
              </div>
              <Progress value={health?.system.memory.percentage} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">CPU Load</span>
                <span className="text-sm text-muted-foreground">
                  {health?.system.cpu.loadAverage[0]?.toFixed(2)}
                </span>
              </div>
              <Progress value={(health?.system.cpu.loadAverage[0] || 0) * 25} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Request Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.requests.total.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.requests.successful || 0} successful
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.requests.averageResponseTime.toFixed(0) || 0}ms
            </div>
            <p className="text-xs text-muted-foreground">
              P95: {metrics?.requests.p95ResponseTime || 0}ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.requests.total 
                ? ((metrics.errors.total / metrics.requests.total) * 100).toFixed(2)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.errors.total || 0} errors
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.performance.cacheHitRate.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Performance optimization
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Business Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Business Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center">
              <Users className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <p className="text-2xl font-bold">{metrics?.business.newUsers || 0}</p>
              <p className="text-xs text-muted-foreground">New Users</p>
            </div>
            <div className="text-center">
              <Activity className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <p className="text-2xl font-bold">{metrics?.business.activeUsers || 0}</p>
              <p className="text-xs text-muted-foreground">Active Users</p>
            </div>
            <div className="text-center">
              <Server className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <p className="text-2xl font-bold">{metrics?.business.jobsPosted || 0}</p>
              <p className="text-xs text-muted-foreground">Jobs Posted</p>
            </div>
            <div className="text-center">
              <Database className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
              <p className="text-2xl font-bold">{metrics?.business.applicationsSubmitted || 0}</p>
              <p className="text-xs text-muted-foreground">Applications</p>
            </div>
            <div className="text-center">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
              <p className="text-2xl font-bold">{metrics?.business.matchesCreated || 0}</p>
              <p className="text-xs text-muted-foreground">Matches</p>
            </div>
            <div className="text-center">
              <Globe className="h-8 w-8 mx-auto mb-2 text-pink-600" />
              <p className="text-2xl font-bold">{metrics?.business.messagessSent || 0}</p>
              <p className="text-xs text-muted-foreground">Messages</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Error Distribution</CardTitle>
            <CardDescription>Errors by status code</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={errorData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {errorData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance Overview</CardTitle>
            <CardDescription>Average response times by service</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}