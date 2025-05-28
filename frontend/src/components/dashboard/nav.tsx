"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import {
  Briefcase,
  Building,
  FileText,
  Home,
  MessageSquare,
  Settings,
  Users,
  Calendar,
  BarChart,
  Search,
} from "lucide-react";

export function DashboardNav() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);

  const navigation = {
    job_seeker: [
      { name: "Dashboard", href: "/dashboard/job-seeker", icon: Home },
      { name: "Browse Jobs", href: "/jobs", icon: Search },
      { name: "Applications", href: "/applications", icon: FileText },
      { name: "Messages", href: "/messages", icon: MessageSquare },
      { name: "Profile", href: "/profile", icon: Users },
      { name: "Settings", href: "/settings", icon: Settings },
    ],
    recruiter: [
      { name: "Dashboard", href: "/dashboard/recruiter", icon: Home },
      { name: "Job Postings", href: "/recruiter/jobs", icon: Briefcase },
      { name: "Candidates", href: "/recruiter/candidates", icon: Users },
      { name: "Applications", href: "/recruiter/applications", icon: FileText },
      { name: "Interviews", href: "/recruiter/interviews", icon: Calendar },
      { name: "Messages", href: "/messages", icon: MessageSquare },
      { name: "Analytics", href: "/recruiter/analytics", icon: BarChart },
      { name: "Settings", href: "/settings", icon: Settings },
    ],
    company_admin: [
      { name: "Dashboard", href: "/dashboard/company", icon: Home },
      { name: "Company Profile", href: "/company/profile", icon: Building },
      { name: "Job Postings", href: "/company/jobs", icon: Briefcase },
      { name: "Recruiters", href: "/company/recruiters", icon: Users },
      { name: "Applications", href: "/company/applications", icon: FileText },
      { name: "Analytics", href: "/company/analytics", icon: BarChart },
      { name: "Settings", href: "/settings", icon: Settings },
    ],
  };

  const navItems = user ? navigation[user.userType] || [] : [];

  return (
    <nav className="w-64 border-r bg-gray-50 dark:bg-gray-900">
      <div className="flex h-16 items-center px-6 border-b">
        <Link href="/" className="flex items-center space-x-2">
          <Briefcase className="h-6 w-6" />
          <span className="font-bold text-xl">RaaS</span>
        </Link>
      </div>
      <div className="px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}