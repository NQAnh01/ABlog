import { Link, Navigate } from "react-router-dom";
import { Bookmark, BookOpen, CheckSquare, PenLine, Settings, UserRound } from "lucide-react";
import { Layout, Loading } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useI18n } from "../i18n";

export function PersonalPage() {
  const { user, loading } = useAuth();
  const { locale } = useI18n();
  if (loading) return <Layout dark><Loading /></Layout>;
  if (!user) return <Navigate to="/login" replace />;
  const vi = locale === "vi";
  const items = [
    { to: "/blog/manage", icon: PenLine, title: vi ? "Quản lý bài viết" : "Manage stories", text: vi ? "Tạo, chỉnh sửa, xuất bản và sắp xếp bài viết." : "Create, edit, publish, and organize your stories." },
    { to: user.username ? `/author/${user.username}` : "/personal/settings", icon: UserRound, title: vi ? "Hồ sơ tác giả" : "Author profile", text: vi ? "Xem trang hồ sơ công khai của bạn." : "View your public author page." },
    { to: "/personal/reading-list", icon: Bookmark, title: vi ? "Danh sách đọc" : "Reading list", text: vi ? "Các bài viết bạn đã lưu để đọc sau." : "Stories you saved for later." },
    { to: "/personal/targets", icon: CheckSquare, title: vi ? "Mục tiêu và công việc" : "Targets and todos", text: vi ? "Theo dõi kế hoạch cá nhân và tiến độ." : "Track personal plans and progress." },
    { to: "/personal/offline", icon: BookOpen, title: vi ? "Thư viện offline" : "Offline library", text: vi ? "Nội dung có thể đọc khi không có mạng." : "Content available without a connection." },
    { to: "/personal/settings", icon: Settings, title: vi ? "Cài đặt" : "Settings", text: vi ? "Hồ sơ, bảo mật, giao diện và ngôn ngữ." : "Profile, security, appearance, and language." },
  ];
  return <Layout dark><section className="personal-hub container"><header><span className="eyebrow">{vi ? "KHÔNG GIAN CÁ NHÂN" : "PERSONAL SPACE"}</span><h1>{vi ? `Xin chào, ${user.name}` : `Welcome, ${user.name}`}</h1><p>{vi ? "Mọi công cụ cá nhân của bạn được sắp xếp tại một nơi." : "Everything personal is organized in one place."}</p></header><div className="personal-grid">{items.map(({to,icon:Icon,title,text})=><Link to={to} key={to}><Icon aria-hidden="true"/><span><strong>{title}</strong><small>{text}</small></span><b aria-hidden="true">→</b></Link>)}</div></section></Layout>;
}
