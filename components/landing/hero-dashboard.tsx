const STATS = [
  { label: "بازدید تأییدشده", value: "۸۴۰٬۰۰۰", note: "در ۷ روز اخیر" },
  { label: "CPM مؤثر", value: "۱۸٬۵۰۰", note: "تومان به‌ازای هزار بازدید" },
  { label: "بودجه مصرف‌شده", value: "۶۲٪", note: "از کل بودجه کمپین" },
  { label: "کریتورهای فعال", value: "۱۲", note: "از ۱۸ عضو تیم" },
];

const DAYS = ["شنبه", "دوشنبه", "چهارشنبه", "جمعه"];
const DAY_X = [40, 210, 380, 550];
const Y_GRID = [
  { label: "۴۰ هزار", y: 14 },
  { label: "۳۰ هزار", y: 54 },
  { label: "۲۰ هزار", y: 94 },
  { label: "۱۰ هزار", y: 134 },
];

const LINE =
  "M40,126 L125,102 L210,114 L295,78 L380,86 L465,50 L550,22";
const AREA = `${LINE} L550,174 L40,174 Z`;

export function HeroDashboard() {
  return (
    <div className="w-full overflow-hidden rounded-card border border-line bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg">
            کمپین بهار — پوشاک و فشن
          </p>
          <p className="mt-0.5 text-xs text-subtle">
            CPM · پرداخت به‌ازای هزار نمایش تأییدشده
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary-soft">
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
          فعال
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-line bg-line">
        {STATS.map((stat) => (
          <div key={stat.label} className="bg-card px-5 py-4">
            <p className="text-xs font-medium text-subtle">{stat.label}</p>
            <p className="tabular mt-1.5 text-2xl font-semibold tracking-tight text-fg">
              {stat.value}
            </p>
            <p className="mt-1 text-[11px] text-subtle">{stat.note}</p>
          </div>
        ))}
      </div>

      <div className="px-5 py-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-muted">بودجه مصرف‌شده</span>
          <span className="tabular font-semibold text-fg">۶۲٪</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-hover">
          <div className="h-full w-[62%] rounded-full bg-primary" />
        </div>
        <p className="mt-2 text-[11px] text-subtle">
          ۳٬۷۲۰٬۰۰۰ تومان از ۶٬۰۰۰٬۰۰۰ تومان
        </p>
      </div>

      <div className="border-t border-line px-5 pb-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted">
            عملکرد کمپین · بازدید تأییدشده
          </p>
          <span className="text-[11px] text-subtle">۷ روز اخیر</span>
        </div>

        <p className="sr-only">
          نمودار رشد بازدید تأییدشده کمپین: از ۱۲۰ هزار در روز اول به ۳۸۰ هزار
          در روز هفتم رسیده است.
        </p>
        <svg
          viewBox="0 0 560 200"
          className="mt-2 w-full"
          aria-hidden="true"
          focusable="false"
        >
          {Y_GRID.map((tick) => (
            <g key={tick.label}>
              <line
                x1={40}
                x2={550}
                y1={tick.y}
                y2={tick.y}
                stroke="#202720"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
              <text
                x={34}
                y={tick.y + 3}
                textAnchor="end"
                fontSize="10"
                className="fill-subtle"
              >
                {tick.label}
              </text>
            </g>
          ))}

          <path d={AREA} fill="#22c55e" fillOpacity="0.1" />
          <path
            d={LINE}
            fill="none"
            stroke="#22c55e"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1={550}
            x2={550}
            y1={22}
            y2={174}
            stroke="#4ade80"
            strokeWidth="1"
            strokeDasharray="2 4"
            opacity="0.6"
          />
          <circle cx={550} cy={22} r="4" fill="#080a09" stroke="#22c55e" strokeWidth="2" />

          {DAYS.map((day, i) => (
            <text
              key={day}
              x={DAY_X[i]}
              y={194}
              textAnchor="middle"
              fontSize="11"
              className="fill-subtle"
            >
              {day}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}