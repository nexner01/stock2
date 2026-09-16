import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-6 px-6 py-12">
      <span className="w-fit rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-sm text-slate-300">
        로컬 MVP 기반 준비 완료
      </span>
      <div className="max-w-3xl space-y-3">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Stock2</h1>
        <p className="text-lg leading-8 text-slate-300">
          시장·종목·포트폴리오 데이터를 출처와 기준 시각, 계산 가정과 함께 탐색합니다.
        </p>
      </div>
      <div>
        <Button disabled>시장 데이터 기능은 다음 단계에서 연결됩니다</Button>
      </div>
    </main>
  );
}
