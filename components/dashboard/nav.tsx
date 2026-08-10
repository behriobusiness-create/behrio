import {
  IconDashboard,
  IconStore,
  IconWallet,
  IconRocket,
  IconUsers,
  IconBank,
  IconActivity,
  IconPercent,
  IconChart,
  IconSettings,
  IconHelpCircle,
} from "@/components/icons";

export type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  home?: boolean;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const creatorNav: NavSection[] = [
  {
    title: "اصلی",
    items: [
      { label: "داشبورد", href: "/creator", icon: <IconDashboard className="h-5 w-5" />, home: true },
      { label: "کشف کمپین", href: "/creator/marketplace", icon: <IconStore className="h-5 w-5" /> },
      { label: "کیف پول", href: "/creator/wallet", icon: <IconWallet className="h-5 w-5" /> },
    ],
  },
  {
    title: "حساب",
    items: [
      { label: "تنظیمات", href: "/settings", icon: <IconSettings className="h-5 w-5" /> },
    ],
  },
];

export const businessNav: NavSection[] = [
  {
    title: "اصلی",
    items: [
      { label: "داشبورد", href: "/business", icon: <IconDashboard className="h-5 w-5" />, home: true },
      { label: "درخواست‌های همکاری", href: "/business/applications", icon: <IconUsers className="h-5 w-5" /> },
      { label: "تبدیل‌ها", href: "/business/conversions", icon: <IconChart className="h-5 w-5" /> },
      { label: "گزارش‌های نمایش", href: "/business/reports", icon: <IconActivity className="h-5 w-5" /> },
    ],
  },
  {
    title: "حساب",
    items: [
      { label: "تنظیمات", href: "/settings", icon: <IconSettings className="h-5 w-5" /> },
    ],
  },
];

export const adminNav: NavSection[] = [
  {
    title: "اصلی",
    items: [
      { label: "داشبورد", href: "/admin", icon: <IconDashboard className="h-5 w-5" />, home: true },
      { label: "کمپین‌ها", href: "/admin/campaigns", icon: <IconRocket className="h-5 w-5" /> },
      { label: "یکپارچه‌سازی‌ها", href: "/admin/integrations", icon: <IconActivity className="h-5 w-5" /> },
      { label: "کاربران", href: "/admin/users", icon: <IconUsers className="h-5 w-5" /> },
    ],
  },
  {
    title: "درآمدسازی",
    items: [
      { label: "کارمزدها", href: "/admin/commissions", icon: <IconPercent className="h-5 w-5" /> },
      { label: "تبدیل‌ها", href: "/admin/conversions", icon: <IconChart className="h-5 w-5" /> },
      { label: "گزارش‌های نمایش", href: "/admin/reports", icon: <IconActivity className="h-5 w-5" /> },
      { label: "برداشت‌ها", href: "/admin/withdrawals", icon: <IconBank className="h-5 w-5" /> },
    ],
  },
  {
    title: "حساب",
    items: [
      { label: "تنظیمات", href: "/settings", icon: <IconSettings className="h-5 w-5" /> },
    ],
  },
];

export const helpItems: NavItem[] = [
  { label: "راهنما", href: "/settings", icon: <IconHelpCircle className="h-4 w-4" /> },
];

export function isActive(activeHref: string, item: NavItem): boolean {
  if (item.home) return activeHref === item.href;
  return activeHref === item.href || activeHref.startsWith(`${item.href}/`);
}
