import { useEffect, useId, useState } from "react";
import type { Trade } from "@shared/schema";
import { formatR, formatDate, computeStats } from "@/lib/tradeUtils";
import { sampleWindow, sequenceGrade, sequenceSamples, sequenceStats, sequenceTrades } from "@/lib/sequence";
import { isCleanLossTag } from "@/lib/cleanLoss";
import { FilterPills } from "./FilterPills";
import "./Sequence.css";

const teal = "var(--seq-win)", red = "var(--seq-loss)", amber = "var(--seq-neutral)";
const resultColor = (r: number) => r > 0.0001 ? teal : r < -0.0001 ? red : amber;

export function SequenceSwitch({ options, value, onChange, label }: { options: string[]; value: string; onChange: (value: string) => void; label: string }) {
  return <div role="group" aria-label={label}><FilterPills options={options.map(option => ({ id: option, label: option }))} activeId={value} onChange={onChange} /></div>;
}

function Sparkline({ trades }: { trades: Trade[] }) {
  const id = useId().replace(/:/g, "");
  let running = 0;
  const values = [0, ...trades.map(t => running += t.realisedR)];
  const min = Math.min(...values), range = Math.max(...values) - min || 1;
  const points = values.map((v, i) => ({ x: i / (values.length - 1) * 300, y: 39 - (v - min) / range * 28 }));
  const color = resultColor(running);
  const d = `M ${points[0].x} ${points[0].y}` + points.slice(1).map((p, i) => {
    const a = points[i], mid = (a.x + p.x) / 2;
    return ` C ${mid} ${a.y}, ${mid} ${p.y}, ${p.x} ${p.y}`;
  }).join("");
  return <svg viewBox="0 0 300 52" preserveAspectRatio="none" className="sequence-spark" role="img" aria-label={`Cumulative result ${formatR(running)}`}>
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor={color} stopOpacity=".07" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
    <path d={`${d} L 300 52 L 0 52 Z`} fill={`url(#${id})`} /><path d={d} fill="none" stroke={color} strokeWidth="1.1" />
  </svg>;
}

function SampleReview({ trades, mode, size }: { trades: Trade[]; mode: string; size: number }) {
  const storageKey = `tj_sample_review_v1:journal:${mode}:${trades[0].id}${size === 10 ? "" : `:size-${size}`}`;
  const [review, setReview] = useState<{ lesson: string; rule: string }>(() => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return { lesson: typeof value.lesson === "string" ? value.lesson : "", rule: typeof value.rule === "string" ? value.rule : "" };
    } catch { return { lesson: "", rule: "" }; }
  });
  const [status, setStatus] = useState("");
  const counts = new Map<string, number>();
  trades.forEach(trade => {
    new Set((trade.mistakes || []).filter(tag => !isCleanLossTag(tag)).map(tag => tag.trim().replace(/\s+/g, " ").toLowerCase()).filter(Boolean)).forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1));
  });
  const mistakes = Array.from(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3);
  return <div className="sequence-review">
    <h4>Mistake patterns</h4>
    {mistakes.length ? mistakes.map(([tag, count]) => <p key={tag} className="sequence-mistake"><span>{tag}</span><b>{count} / {trades.length} trades</b></p>) : <p className="sequence-review-hint">No mistake tags recorded, excluding accepted model-loss tags.</p>}
    <h4>Sample review</h4>
    <label>What did you learn?<textarea aria-label="Lesson from this sample" value={review.lesson} placeholder="One observation worth remembering…" onChange={e => { setReview({ ...review, lesson: e.target.value }); setStatus("Unsaved"); }} /></label>
    <label>One rule for the next {size} trades<textarea aria-label={`Rule for the next ${size} trades`} value={review.rule} placeholder="A specific action for the next sample…" onChange={e => { setReview({ ...review, rule: e.target.value }); setStatus("Unsaved"); }} /></label>
    <div className="sequence-review-save"><button type="button" onClick={() => {
      try { localStorage.setItem(storageKey, JSON.stringify(review)); setStatus("Saved in this browser"); }
      catch { setStatus("Could not save. Browser storage is unavailable."); }
    }}>Save review</button><span role="status">{status || "Reviews stay in this browser"}</span></div>
  </div>;
}


export function Sequence({ trades }: { trades: Trade[] }) {
  const [mode, setMode] = useState("Actual");
  const [size, setSize] = useState(10);
  const [offset, setOffset] = useState(0);
  useEffect(() => setOffset(0), [trades, mode, size]);
  const items = sequenceTrades(trades, mode === "Clean Model");
  const batches = sequenceSamples(items, size);
  const completed = batches.filter(b => b.length === size);
  const positive = completed.filter(b => sequenceStats(b.map(i => i.trade)).totalR > 0).length;
  const open = batches.find(b => b.length < size);
  const { start, end } = sampleWindow(batches.length, offset);
  return <section className="sequence-samples-view" aria-label="Sequence trade samples">
    <div className="sequence-samples-toolbar"><SequenceSwitch options={["Actual", "Clean Model"]} value={mode} onChange={setMode} label="Sequence model" /><SequenceSwitch options={["10 trades", "20 trades", "30 trades"]} value={`${size} trades`} onChange={value => setSize(parseInt(value, 10))} label="Sample size" /></div>
    {!!items.length && <div className="sequence-overview"><div><small>COMPLETED SAMPLES</small><strong>{completed.length}</strong></div><div><small>POSITIVE SAMPLES</small><strong>{positive}<span> / {completed.length}</span></strong></div><div><small>CURRENT SAMPLE</small><strong>{open ? open.length : size}<span> / {size} trades</span></strong></div></div>}
    {!!items.length && <div className="sequence-pagination"><span>Samples {start + 1}–{end} of {batches.length}{offset === 0 ? " · latest" : ""}</span><div><button type="button" aria-label="Older samples" disabled={start === 0} onClick={() => setOffset(offset + 3)}>← Older</button><button type="button" aria-label="Newer samples" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 3))}>Newer →</button></div></div>}
    {!items.length ? <div className="sequence-empty">No trades in this selection. Adjust the date or year filter to see your samples.</div> : <div className="sequence-samples">{batches.slice(start, end).map((batch, visibleIndex) => {
      const index = start + visibleIndex;
      const s = sequenceStats(batch.map(i => i.trade));
      const stats = computeStats(batch.map(i => i.trade));
      const previous = index > 0 ? sequenceStats(batches[index - 1].map(i => i.trade)) : null;
      const delta = previous && batch.length === size ? s.totalR - previous.totalR : null;
      const aR = batch.filter(i => sequenceGrade(i.trade) === "A+").reduce((sum, i) => sum + i.trade.realisedR, 0);
      const fakeR = batch.filter(i => sequenceGrade(i.trade) === "Fake A+").reduce((sum, i) => sum + i.trade.realisedR, 0);
      return <article key={`${mode}-${size}-${index}`} className="sequence-sample"><div className="sequence-sample-head"><span>Sample {String(index + 1).padStart(2,"0")}</span><small>{batch.length < size ? `${batch.length}/${size} · building` : "Complete"}</small></div><p className="sequence-range">Trades {index * size + 1}–{index * size + batch.length} · {formatDate(batch[0].trade.date)} – {formatDate(batch[batch.length - 1].trade.date)}</p><div className="sequence-sample-body"><div><strong style={{ color: resultColor(s.totalR) }}>{formatR(s.totalR)}</strong><p>{s.wins}W / {s.losses}L{s.bes ? ` / ${s.bes}BE` : ""}</p></div><dl><div><dt>A+ Trades</dt><dd style={{ color: teal }}>{s.aPlus}</dd></div><div><dt>Fake A+ Trades</dt><dd style={{ color: red }}>{s.fake}</dd></div><div><dt>A+ Purity</dt><dd>{s.purity}</dd></div></dl></div><Sparkline trades={batch.map(i => i.trade)} /><div className="sequence-trade-strip" aria-label="Individual trade results">{batch.map(i => <span key={i.trade.id} style={{background:resultColor(i.trade.realisedR)}} title={`#${i.number} ${i.trade.symbol}: ${formatR(i.trade.realisedR)}`} />)}{Array.from({length:size-batch.length},(_,i)=><span key={`empty-${i}`} className="unfilled" />)}</div><div className="sequence-extra"><div><small>AVG / TRADE</small><b>{formatR(stats.avgR)}</b></div><div><small>MAX DRAWDOWN</small><b>{formatR(-stats.maxDrawdown)}</b></div><div><small>VS PREVIOUS</small><b style={{color:delta === null ? "#888" : resultColor(delta)}}>{delta === null ? "—" : formatR(delta)}</b></div></div><details className="sequence-inspect"><summary>Explore this sample <span>+</span></summary><div className="sequence-quality"><span>A+ result <b style={{color:resultColor(aR)}}>{formatR(aR)}</b></span><span>Fake A+ result <b style={{color:resultColor(fakeR)}}>{formatR(fakeR)}</b></span><span>Best / worst <b>{formatR(stats.bestR)} / {formatR(stats.worstR)}</b></span></div><div className="sequence-trades-list">{batch.map(({trade,number})=><div key={trade.id}><span>#{number} <b>{trade.symbol}</b><small>{trade.setupGrade || "Ungraded"}</small></span><b style={{color:resultColor(trade.realisedR)}}>{formatR(trade.realisedR)}</b></div>)}</div><SampleReview key={`${mode}-${size}-${batch[0].trade.id}`} trades={batch.map(i => i.trade)} mode={mode} size={size} /></details></article>;
    })}</div>}
    <p className="sequence-footnote">{mode === "Clean Model" && "Clean Model excludes mistake-tagged trades except accepted model-loss tags. "}Purity = A+ / (A+ + Fake A+).</p>
  </section>;
}
