"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Bot,
  Building2,
  ChevronsUpDown,
  Database,
  Dices,
  FileSearch,
  FlaskConical,
  Globe,
  LayoutDashboard,
  LineChart,
  ListChecks,
  LogOut,
  Megaphone,
  Radar,
  Send,
  Settings,
  Sprout,
  Swords,
  Target,
  TrendingUp,
  Wrench,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type NavItem = { href: string; title: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Analyze",
    items: [
      { href: "/demo/growth-intelligence", title: "Growth Intelligence", icon: Sprout },
      { href: "/demo/dashboard", title: "Dashboard", icon: LayoutDashboard },
      { href: "/demo/business", title: "Business graph", icon: Building2 },
      { href: "/demo/audit", title: "Audit workspace", icon: FileSearch },
      { href: "/demo/site-intelligence", title: "Site intelligence", icon: Wrench },
      { href: "/demo/ingestion", title: "Ingestion & data mesh", icon: Database },
    ],
  },
  {
    label: "Grow",
    items: [
      { href: "/demo/marketing", title: "Marketing OS", icon: Megaphone },
      { href: "/demo/opportunities", title: "Opportunities", icon: Target },
      { href: "/demo/content", title: "Content planner", icon: BookOpen },
      { href: "/demo/ai-visibility", title: "AI visibility", icon: Radar },
      { href: "/demo/geo-engines", title: "Cross-engine visibility", icon: Globe },
      { href: "/demo/geo-fixes", title: "GEO citation fixes", icon: Wand2 },
      { href: "/demo/geo-lift", title: "Proven citation lift", icon: LineChart },
      { href: "/demo/research", title: "Research engine", icon: FlaskConical },
      { href: "/demo/competitors", title: "Competitors", icon: Swords },
      { href: "/demo/bandit", title: "CRO bandit", icon: Dices },
      { href: "/demo/sdr", title: "SDR audits", icon: Send },
    ],
  },
  {
    label: "Measure",
    items: [
      { href: "/demo/outcomes", title: "Outcomes", icon: TrendingUp },
      { href: "/demo/community", title: "Community playbooks", icon: BarChart3 },
      { href: "/demo/epics", title: "Epic registry", icon: ListChecks },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/demo/assistant", title: "Growth assistant", icon: Bot },
      { href: "/demo/settings", title: "Project settings", icon: Settings },
    ],
  },
];

export const NAV_LABELS: Record<string, string> = Object.fromEntries(
  NAV_GROUPS.flatMap((group) => group.items.map((item) => [item.href, item.title])),
);

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Sprout className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">OpenGrowth AI</span>
                    <span className="truncate text-xs text-muted-foreground">Growth workspace</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg" align="start">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Workspace</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link href="/demo/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/">← Back to marketing site</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.title}>
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">
                      <Sprout className="size-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">You</span>
                    <span className="truncate text-xs text-muted-foreground">Local workspace</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 rounded-lg" align="end" side="top">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/">
                    <LogOut className="size-4" /> Exit workspace
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
