"use client";

import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { analyticsService } from "@/services/analytics.service";
import { jobService } from "@/services/job.service";
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from "recharts";
import { 
  Briefcase, Users, TrendingUp, Clock, 
  FileText, Calendar, Target, Activity 
} from "lucide-react";
import Link from "next/link";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function RecruiterDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['recruiter-stats'],
    queryFn: () => analyticsService.getRecruiterStats(),
  });

  const { data: activeJobs } = useQuery({
    queryKey: ['active-jobs'],
    queryFn: () => jobService.getJobs({ status: 'active', limit: 5 }),
  });

  if (isLoading) {
    return <div>Loading analytics...</div>;
  }

  const pipelineData = stats?.candidatePipeline ? [
    { name: 'Submitted', value: stats.candidatePipeline.submitted },
    { name: 'Reviewing', value: stats.candidatePipeline.reviewing },
    { name: 'Shortlisted', value: stats.candidatePipeline.shortlisted },
    { name: 'Interviewing', value: stats.candidatePipeline.interviewing },
    { name: 'Hired', value: stats.candidatePipeline.hired }
  ] : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Recruiter Dashboard</h2>
        <p className="text-muted-foreground">
          Track your recruitment performance and manage candidates
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.overview.activeJobs || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.overview.avgApplicationsPerJob || 0} applications per job
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.overview.totalApplications || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.overview.pendingReview || 0} pending review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Time to Fill</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.overview.avgTimeToFill || 0} days</div>
            <p className="text-xs text-muted-foreground">
              Average across all positions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hired This Month</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.overview.hired || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.responseMetrics.responseRate || 0}% response rate
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pipeline">Candidate Pipeline</TabsTrigger>
          <TabsTrigger value="jobs">Job Performance</TabsTrigger>
          <TabsTrigger value="metrics">Response Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recruitment Funnel</CardTitle>
              <CardDescription>
                Track candidates through each stage of the hiring process
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pipelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Job Performance</CardTitle>
              <CardDescription>
                View metrics for your active job postings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.jobPerformance.map((job: any) => (
                  <div
                    key={job.jobId}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold">{job.title}</h4>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span>{job.views} views</span>
                        <span>{job.applications} applications</span>
                        <span>{job.conversionRate.toFixed(1)}% conversion</span>
                        <span>Avg match: {job.avgMatchScore}%</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/recruiter/jobs/${job.jobId}`}>View Details</Link>
                      </Button>
                      <Button asChild size="sm">
                        <Link href={`/recruiter/jobs/${job.jobId}/candidates`}>
                          View Candidates
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Response Time</CardTitle>
                <CardDescription>Average time to first response</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {stats?.responseMetrics.avgResponseTime || 0}h
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Industry average: 48h
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Response Rate</CardTitle>
                <CardDescription>Percentage of applications reviewed</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {stats?.responseMetrics.responseRate?.toFixed(1) || 0}%
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Target: 95%+
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Interview Rate</CardTitle>
                <CardDescription>Shortlisted to interview conversion</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {stats?.responseMetrics.interviewScheduleRate?.toFixed(1) || 0}%
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Industry average: 75%
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <div className="flex justify-center gap-4">
        <Button asChild>
          <Link href="/recruiter/jobs/new">
            <Briefcase className="mr-2 h-4 w-4" />
            Post New Job
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/recruiter/candidates">
            <Users className="mr-2 h-4 w-4" />
            Browse Candidates
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/recruiter/interviews">
            <Calendar className="mr-2 h-4 w-4" />
            Manage Interviews
          </Link>
        </Button>
      </div>
    </div>
  );
}