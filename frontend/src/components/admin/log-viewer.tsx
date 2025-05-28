'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Download, Filter, Search, AlertCircle, Info, AlertTriangle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { cn } from '@/lib/utils';

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  metadata?: Record<string, any>;
  userId?: string;
  requestId?: string;
  path?: string;
  method?: string;
  duration?: number;
  statusCode?: number;
}

interface LogFilters {
  level?: string;
  search?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  path?: string;
}

const LOG_LEVELS = {
  error: { color: 'text-red-600', icon: XCircle, bgColor: 'bg-red-50' },
  warn: { color: 'text-yellow-600', icon: AlertTriangle, bgColor: 'bg-yellow-50' },
  info: { color: 'text-blue-600', icon: Info, bgColor: 'bg-blue-50' },
  debug: { color: 'text-gray-600', icon: AlertCircle, bgColor: 'bg-gray-50' },
  security: { color: 'text-purple-600', icon: AlertCircle, bgColor: 'bg-purple-50' },
  performance: { color: 'text-green-600', icon: AlertCircle, bgColor: 'bg-green-50' },
  audit: { color: 'text-indigo-600', icon: AlertCircle, bgColor: 'bg-indigo-50' }
};

export function LogViewer() {
  const [filters, setFilters] = useState<LogFilters>({});
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(false);

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['logs', filters],
    queryFn: async () => {
      const response = await apiService.get('/logs', { params: filters });
      return response.data;
    },
    refetchInterval: autoRefresh ? 5000 : false
  });

  const toggleExpanded = useCallback((logId: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  }, []);

  const handleExport = useCallback(async () => {
    try {
      const response = await apiService.get('/logs/export', {
        params: filters,
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  }, [filters]);

  const renderLogLevel = (level: string) => {
    const config = LOG_LEVELS[level as keyof typeof LOG_LEVELS] || LOG_LEVELS.info;
    const Icon = config.icon;
    
    return (
      <Badge variant="outline" className={cn('gap-1', config.color)}>
        <Icon className="h-3 w-3" />
        {level.toUpperCase()}
      </Badge>
    );
  };

  const renderMetadata = (metadata: Record<string, any>) => {
    return (
      <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
        {JSON.stringify(metadata, null, 2)}
      </pre>
    );
  };

  useEffect(() => {
    const interval = autoRefresh ? setInterval(refetch, 5000) : null;
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, refetch]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>System Logs</CardTitle>
            <CardDescription>
              Real-time system logs and events
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', autoRefresh && 'animate-spin')} />
              Auto Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Select
            value={filters.level || 'all'}
            onValueChange={(value) => setFilters({ ...filters, level: value === 'all' ? undefined : value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Log Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              {Object.keys(LOG_LEVELS).map(level => (
                <SelectItem key={level} value={level}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search logs..."
              value={filters.search || ''}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-10"
            />
          </div>

          <Input
            placeholder="User ID"
            value={filters.userId || ''}
            onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
          />

          <Input
            placeholder="Path"
            value={filters.path || ''}
            onChange={(e) => setFilters({ ...filters, path: e.target.value })}
          />
        </div>

        {/* Logs */}
        <ScrollArea className="h-[600px] pr-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading logs...
            </div>
          ) : logs?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No logs found
            </div>
          ) : (
            <div className="space-y-2">
              {logs?.map((log: LogEntry) => {
                const isExpanded = expandedLogs.has(log.id);
                const config = LOG_LEVELS[log.level as keyof typeof LOG_LEVELS] || LOG_LEVELS.info;
                
                return (
                  <div
                    key={log.id}
                    className={cn(
                      'p-3 rounded-lg border cursor-pointer transition-colors',
                      config.bgColor,
                      'hover:shadow-sm'
                    )}
                    onClick={() => toggleExpanded(log.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {renderLogLevel(log.level)}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss.SSS')}
                          </span>
                          {log.requestId && (
                            <Badge variant="outline" className="text-xs">
                              {log.requestId.slice(0, 8)}
                            </Badge>
                          )}
                          {log.userId && (
                            <Badge variant="outline" className="text-xs">
                              User: {log.userId}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="font-mono text-sm">
                          {log.message}
                        </div>
                        
                        {log.path && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {log.method} {log.path}
                            {log.statusCode && (
                              <span className={cn(
                                'ml-2',
                                log.statusCode >= 400 ? 'text-red-600' : 'text-green-600'
                              )}>
                                [{log.statusCode}]
                              </span>
                            )}
                            {log.duration && (
                              <span className="ml-2">
                                {log.duration}ms
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {isExpanded && log.metadata && (
                      renderMetadata(log.metadata)
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}