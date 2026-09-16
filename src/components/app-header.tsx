import { BarChart3, BriefcaseBusiness, Search, Sparkles, TrendingUp } from "lucide-react";
import Link from "next/link";

export function AppHeader({
  active = "market",
}: Readonly<{ active?: "market" | "portfolio" | "recommended" }>) {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link className="brand" href="/" aria-label="Stock2 홈">
          <span className="brand__mark">
            <TrendingUp aria-hidden="true" size={20} />
          </span>
          <span>
            Stock<span>2</span>
          </span>
          <span className="live-pill">● LIVE</span>
        </Link>
        <nav className="primary-nav" aria-label="주요 메뉴">
          <Link aria-current={active === "market" ? "page" : undefined} href="/">
            <Search size={16} />
            주식 검색 및 시황
          </Link>
          <Link aria-current={active === "portfolio" ? "page" : undefined} href="/portfolio">
            <BriefcaseBusiness size={16} />
            포트폴리오 분석
          </Link>
          <Link
            aria-current={active === "recommended" ? "page" : undefined}
            href="/recommendations"
          >
            <Sparkles size={16} />
            추천 포트폴리오
          </Link>
        </nav>
        <div className="header-market">
          <BarChart3 size={15} /> 시장 데이터
        </div>
      </div>
    </header>
  );
}
