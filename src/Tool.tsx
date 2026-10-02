// Screwdriver: repair or replace? Weighs the repair quote against the product's remaining life, and finds guides and parts.
import { useState } from "react";
import { moneyFmt } from "./lib/money";
import { uid, useStored } from "./lib/store";
import { CurrencySelect, Section, Stat, Stats } from "./ui/kit";

const T = "screwdriver";
// Typical useful life in years and rough embodied carbon (kg CO2e) to make a new one. Public averages, used for comparison.
const KINDS: Record<string, { life: number; kg: number; fixes: string }> = {
  Smartphone: { life: 4, kg: 70, fixes: "Batteries and screens are the most common, cheapest fixes." }, Laptop: { life: 6, kg: 300, fixes: "Batteries, keyboards, fans and SSD upgrades often add years." },
  "Washing machine": { life: 11, kg: 300, fixes: "Pumps, belts, door seals and brushes are cheap parts." }, Fridge: { life: 13, kg: 350, fixes: "Thermostats, fans and door seals are usually worth fixing." },
  Television: { life: 8, kg: 400, fixes: "Power boards and backlights fail most. Cracked panels rarely pay to fix." }, "Coffee machine": { life: 6, kg: 50, fixes: "Descaling and seals fix most problems." },
  Vacuum: { life: 8, kg: 40, fixes: "Belts, filters and batteries." }, Bicycle: { life: 15, kg: 100, fixes: "Almost everything on a bike can be replaced." }, Shoes: { life: 3, kg: 14, fixes: "Resoling good leather shoes costs a fraction of new." },
  "Air conditioner": { life: 12, kg: 500, fixes: "Gas top-ups, capacitors and fan motors." }, Other: { life: 7, kg: 100, fixes: "" },
};
type Item = { id: string; name: string; kind: string; age: number; paid: number; newPrice: number; quote: number; extra: number; problem: string };

function decide(i: Item) {
  const k = KINDS[i.kind] ?? KINDS.Other;
  const left = Math.max(0.5, k.life - i.age), extraLife = Math.max(0.5, Math.min(k.life, i.extra || left));
  // Cost per year of use: repair now versus buying new.
  const perYearRepair = i.quote / extraLife, perYearNew = i.newPrice / k.life;
  const ratio = i.quote / Math.max(1, i.newPrice);
  let v: [string, string, string];
  if (i.quote <= 0) v = ["Get a quote first", "", "Ask a repairer for a price, or look up the part cost below."];
  else if (perYearRepair <= perYearNew * 0.9 && ratio < 0.6) v = ["Repair it", "good", `Repairing costs ${(perYearRepair / perYearNew * 100).toFixed(0)}% of what a new one costs per year of use.`];
  else if (perYearRepair <= perYearNew * 1.2) v = ["Close call, lean to repair", "warn", "Similar cost per year either way. Repairing avoids the waste and the carbon of a new one."];
  else v = ["Replace it", "bad", `The repair costs more per year of use than a new one (${(perYearRepair / perYearNew * 100).toFixed(0)}%).`];
  return { k, left, extraLife, perYearRepair, perYearNew, ratio, v, carbon: k.kg };
}

export default function Screwdriver() {
  const [items, setItems] = useStored<Item[]>(T, "items", [
    { id: "i1", name: "iPhone 12", kind: "Smartphone", age: 3, paid: 2800, newPrice: 2600, quote: 260, extra: 2, problem: "Battery dies by mid-afternoon" },
    { id: "i2", name: "Samsung washing machine", kind: "Washing machine", age: 6, paid: 1300, newPrice: 1450, quote: 180, extra: 5, problem: "Does not drain" },
    { id: "i3", name: "Old LED TV", kind: "Television", age: 7, paid: 900, newPrice: 850, quote: 620, extra: 2, problem: "Cracked screen" },
  ]);
  const [cur, setCur] = useStored(T, "cur", "TND");
  const [open, setOpen] = useState("i1");
  const money = moneyFmt(cur);
  const it = items.find(x => x.id === open) ?? items[0];
  const set = (p: Partial<Item>) => setItems(items.map(x => (x.id === it.id ? { ...x, ...p } : x)));
  const repaired = items.map(decide).filter(r => r.v[0] === "Repair it" || r.v[0].startsWith("Close"));
  const q = (s: string) => encodeURIComponent(s);

  return (
    <div className="stack">
      <Section title="Repair or replace" aside={<CurrencySelect id="sd-cur" value={cur} onChange={setCur} />}>
        <Stats><Stat value={items.length} label="Things broken" /><Stat value={repaired.length} label="Worth repairing" tone="good" /><Stat value={money(items.filter(x => { const v = decide(x).v[0]; return v === "Repair it" || v.startsWith("Close"); }).reduce((a, x) => a + x.newPrice - x.quote, 0))} label="Saved vs buying new" tone="good" /><Stat value={`${items.map(decide).filter(r => r.v[1] !== "bad").reduce((a, r) => a + r.carbon, 0)} kg`} label="CO2e not manufactured" /></Stats>
        <div className="row" style={{ gap: 6, marginTop: 12 }}>{items.map(x => { const r = decide(x); return <button key={x.id} className="btn small" aria-pressed={x.id === it?.id} style={x.id === it?.id ? { background: "var(--ink)", color: "var(--bg)" } : undefined} onClick={() => setOpen(x.id)}>{x.name} · {r.v[0]}</button>; })}<button className="btn small" onClick={() => { const n = { id: uid(), name: "Something broken", kind: "Other", age: 2, paid: 0, newPrice: 500, quote: 0, extra: 0, problem: "" }; setItems([...items, n]); setOpen(n.id); }}>Add another</button></div>
      </Section>
      {it && (() => { const r = decide(it); return <>
        <div className="grid2">
          <Section title="The item">
            <div className="stack" style={{ gap: 10 }}>
              <div className="row"><label className="field"><span>What</span><input className="input" value={it.name} onChange={e => set({ name: e.target.value })} /></label><label className="field"><span>Kind</span><select className="input" value={it.kind} onChange={e => set({ kind: e.target.value })}>{Object.keys(KINDS).map(k => <option key={k}>{k}</option>)}</select></label></div>
              <label className="field"><span>What's wrong</span><input className="input" value={it.problem} onChange={e => set({ problem: e.target.value })} /></label>
              <div className="row"><label className="field"><span>Age (years)</span><input className="input num" value={it.age} onChange={e => set({ age: parseFloat(e.target.value) || 0 })} /></label><label className="field"><span>Price of a similar new one</span><input className="input num" value={it.newPrice} onChange={e => set({ newPrice: parseFloat(e.target.value) || 0 })} /></label></div>
              <div className="row"><label className="field"><span>Repair quote</span><input className="input num" value={it.quote} onChange={e => set({ quote: parseFloat(e.target.value) || 0 })} /></label><label className="field"><span>Extra years after repair (guess)</span><input className="input num" value={it.extra} onChange={e => set({ extra: parseFloat(e.target.value) || 0 })} /></label></div>
              <p className="note">A {it.kind.toLowerCase()} typically lasts about {r.k.life} years. {r.k.fixes}</p>
            </div>
          </Section>
          <section className={"panel sd-v " + r.v[1]}>
            <p className="eyebrow">Verdict</p><h2>{r.v[0]}</h2><p>{r.v[2]}</p>
            <table className="t" style={{ marginTop: 12 }}><tbody>
              <tr><td>Repair: cost per extra year</td><td className="r">{money(r.perYearRepair)}</td></tr>
              <tr><td>New: cost per year of its life</td><td className="r">{money(r.perYearNew)}</td></tr>
              <tr><td>Repair as a share of new</td><td className="r">{Math.round(r.ratio * 100)}%</td></tr>
              <tr><td>Carbon to make a new one</td><td className="r">about {r.carbon} kg CO2e</td></tr>
            </tbody></table>
          </section>
        </div>
        <Section title="Fix it yourself or find help">
          <div className="row">
            <a className="btn" href={`https://www.ifixit.com/Search?query=${q(`${it.name} ${it.problem}`)}`} target="_blank" rel="noreferrer">Repair guides on iFixit</a>
            <a className="btn" href={`https://www.youtube.com/results?search_query=${q(`${it.name} ${it.problem} repair`)}`} target="_blank" rel="noreferrer">Repair videos</a>
            <a className="btn" href={`https://www.google.com/search?q=${q(`${it.name} ${it.problem} spare part`)}`} target="_blank" rel="noreferrer">Spare part prices</a>
            <a className="btn" href={`https://www.google.com/maps/search/${q(`${it.kind} repair`)}`} target="_blank" rel="noreferrer">Repair shops near me</a>
            <a className="btn" href="https://www.repaircafe.org/en/visit/" target="_blank" rel="noreferrer">Find a repair café</a>
          </div>
        </Section>
        <button className="btn ghost small danger" style={{ alignSelf: "flex-start" }} onClick={() => { setItems(items.filter(x => x.id !== it.id)); setOpen(items[0]?.id ?? ""); }}>Remove this item</button>
      </>; })()}
      <style>{`.sd-v{border-top:6px solid var(--line)}.sd-v.good{border-color:var(--good)}.sd-v.warn{border-color:var(--warn)}.sd-v.bad{border-color:var(--bad)}.sd-v h2{font-size:36px;margin:4px 0}`}</style>
    </div>
  );
}
