interface Props {
  nutrition: number | null;
  price: number | null;
  difficulty: number | null;
  time: number | null;
  total: number | null;
}

function bg(v: number) {
  const hue = 4 + (v / 100) * 128;
  const alpha = 0.16 + (v / 100) * 0.34;
  return `hsla(${hue}, 70%, 55%, ${alpha})`;
}

export default function ScoreLine({
  nutrition,
  price,
  difficulty,
  time,
  total,
}: Props) {
  const items = [
    { label: "营养", v: nutrition },
    { label: "价格", v: price },
    { label: "难度", v: difficulty },
    { label: "时间", v: time },
    { label: "总分", v: total, total: true },
  ];
  return (
    <div className="score-line">
      {items.map((it) => (
        <div
          key={it.label}
          className={`sc${it.total ? " sc-total" : ""}`}
          style={it.v != null ? { background: bg(it.v) } : undefined}
        >
          <em>{it.label}</em>
          <b>{it.v ?? "—"}</b>
        </div>
      ))}
    </div>
  );
}
