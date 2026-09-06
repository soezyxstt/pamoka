"use client";

import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  FileClock,
  FileText,
  FolderOpen,
  GalleryVerticalEnd,
  Handshake,
  Images,
  LayoutDashboard,
  Newspaper,
  Settings2,
  ShieldCheck,
  Users,
  type LucideProps,
} from "lucide-react";

export type AdminIconName =
  | "activity"
  | "award"
  | "bar-chart"
  | "book-open"
  | "building"
  | "calendar"
  | "clipboard"
  | "clock"
  | "file"
  | "folder"
  | "gallery"
  | "handshake"
  | "images"
  | "layout"
  | "newspaper"
  | "settings"
  | "shield"
  | "users";

const icons = {
  activity: Activity,
  award: Award,
  "bar-chart": BarChart3,
  "book-open": BookOpen,
  building: Building2,
  calendar: CalendarDays,
  clipboard: ClipboardList,
  clock: FileClock,
  file: FileText,
  folder: FolderOpen,
  gallery: GalleryVerticalEnd,
  handshake: Handshake,
  images: Images,
  layout: LayoutDashboard,
  newspaper: Newspaper,
  settings: Settings2,
  shield: ShieldCheck,
  users: Users,
};

export function AdminIcon({ name, ...props }: { name: AdminIconName } & LucideProps) {
  const Icon = icons[name] ?? icons.file;
  return <Icon aria-hidden="true" {...props} />;
}
