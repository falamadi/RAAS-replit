"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { jobService } from "@/services/job.service";
import { applicationService } from "@/services/application.service";
import { matchingService } from "@/services/matching.service";
import { Briefcase, FileText, Search, Star, TrendingUp } from "lucide-react";
import Link from "next/link";

export default function JobSeekerDashboard() {
  const { data: recommendations } = useQuery({
    queryKey: ['job-recommendations'],
    queryFn: () => matchingService.getJobRecommendations({ limit: 5 }),
  });

  const { data: applications } = useQuery({
    queryKey: ['my-applications'],
    queryFn: () => applicationService.getMyApplications({ limit: 5 }),
  });

  const { data: stats } = useQuery({
    queryKey: ['job-seeker-stats'],
    queryFn: () => applicationService.getApplicationStats(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Welcome back!</h2>
        <p className="text-muted-foreground">
          Here's an overview of your job search activity
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Applications</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              +{stats?.thisWeek || 0} this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Review</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.inReview || 0}</div>
            <p className="text-xs text-muted-foreground">
              Being reviewed by employers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Interviews</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.interviews || 0}</div>
            <p className="text-xs text-muted-foreground">
              Scheduled interviews
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Match Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.matchRate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              Average match score
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="recommendations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recommendations">Recommended Jobs</TabsTrigger>
          <TabsTrigger value="applications">Recent Applications</TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Jobs You Might Like</CardTitle>
              <CardDescription>
                Based on your profile and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recommendations?.jobs.map((job: any) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold">{job.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {job.company.name} • {job.location}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary">
                          {job.matchScore}% Match
                        </Badge>
                        <Badge variant="outline">{job.employmentType}</Badge>
                        {job.salaryRange && (
                          <span className="text-sm text-muted-foreground">
                            ${job.salaryRange.min.toLocaleString()} - ${job.salaryRange.max.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button asChild size="sm">
                      <Link href={`/jobs/${job.id}`}>View Details</Link>
                    </Button>
                  </div>
                ))}
              </div>
              {recommendations?.jobs.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No recommendations available. Complete your profile to get personalized job matches.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="applications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Applications</CardTitle>
              <CardDescription>
                Track the status of your job applications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {applications?.applications.map((application: any) => (
                  <div
                    key={application.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold">{application.job.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {application.job.company.name} • Applied {new Date(application.createdAt).toLocaleDateString()}
                      </p>
                      <Badge
                        variant={
                          application.status === 'submitted' ? 'secondary' :
                          application.status === 'reviewing' ? 'default' :
                          application.status === 'shortlisted' ? 'success' :
                          application.status === 'rejected' ? 'destructive' :
                          'outline'
                        }
                        className="mt-2"
                      >
                        {application.status}
                      </Badge>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/applications/${application.id}`}>View</Link>
                    </Button>
                  </div>
                ))}
              </div>
              {applications?.applications.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  You haven't applied to any jobs yet. Start exploring opportunities!
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-center gap-4">
        <Button asChild>
          <Link href="/jobs">
            <Briefcase className="mr-2 h-4 w-4" />
            Browse All Jobs
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/profile">
            Complete Your Profile
          </Link>
        </Button>
      </div>
    </div>
  );
}