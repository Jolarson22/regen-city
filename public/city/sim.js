/* RE:GEN City Simulator engine – sim.js v1.0 (2026-10-27)
 * Runs in the browser (window.RegenSim) and in Node (module.exports).
 * Exports: runYear(config, seed), monteCarlo(config, n, seed0), WAVES, DEFAULTS, MONTHS.
 * RE:GEN City Simulator · © 2026 Jolarson Tati.
 * Every number is an INDICATIVE assumption; every output is a SIMULATION, NOT A FORECAST.
 * Master-plan figures are marked [plan]; everything else is a Simulator estimate to be verified.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RegenSim = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function rng(seed) { // mulberry32
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function monthOf(d) { let m = 0, s = 0; while (m < 11 && d >= s + MONTH_DAYS[m]) { s += MONTH_DAYS[m]; m++; } return m; }

  // Wave definitions. Stages, build scope [plan]; operating figures are Simulator estimates.
  const WAVES = {
    1: { stages: 4, intlRate: 12, localRate: 30, fixedOpex: 11.0e6, debt: 135e6,
      housingUnits: 300, crewUnits: 150, students: 250, visitors: 40000, visitorSpend: 25, festival: 0.5e6,
      hotelLease: 0, tenantLeases: 0.4e6, rentalOffsite: 3.0e6, postBase: 1.5e6, solarMW: 18, batteryMWh: 40,
      baseLoadMWh: 8, crewPool0: 420, skilled0: 25, shuttles: 6 },
    2: { stages: 10, intlRate: 26, localRate: 50, fixedOpex: 30.0e6, debt: 240e6,
      housingUnits: 750, crewUnits: 250, students: 1400, visitors: 150000, visitorSpend: 60, festival: 2.0e6,
      hotelLease: 4.5e6, tenantLeases: 1.5e6, rentalOffsite: 6.0e6, postBase: 5.0e6, solarMW: 30, batteryMWh: 80,
      baseLoadMWh: 25, crewPool0: 900, skilled0: 70, shuttles: 14 },
    3: { stages: 16, intlRate: 40, localRate: 70, fixedOpex: 49.0e6, debt: 300e6,
      housingUnits: 1100, crewUnits: 300, students: 2600, visitors: 250000, visitorSpend: 72, festival: 2.0e6,
      hotelLease: 9.0e6, tenantLeases: 2.0e6, rentalOffsite: 8.0e6, postBase: 8.0e6, solarMW: 50, batteryMWh: 120,
      baseLoadMWh: 40, crewPool0: 1500, skilled0: 130, shuttles: 22 },
  };
  const YEAR_FACTOR = [0.55, 0.8, 1.0, 1.1, 1.15]; // charter 4.6

  const DEFAULTS = {
    wave: 1, opYear: 3,
    intlDemandMult: 1.0, rebate: false, anchor: false,
    intlRate: 11900, localRate: 4000,            // [plan] USD per occupied stage-day
    crewPerStage: 55, gradsPerYear: 150, unitsPerson: 1.5,
    solarMW: null, batteryMWh: null, housingUnits: null, shuttles: null, debtMUSD: null, // null = wave default
    rainIntensity: 1.0, kwanzaShock: 0, kwanzaDrift: 0.0, indexRecovery: 0.7, // flat FX base (Research, ~AOA 920/USD)
    outagesPerYear: 6, gridFailures: false, ppaPrice: 0.11, dieselPrice: 0.38,
    feePerStudent: 9600, rentPerUnit: 9100,      // [plan]
    variableCostShare: 0.30, sustainingCapex: 0.03, taxRate: 0, // [plan] margin structure, tax holiday
    interestRate: 0.09,                          // [plan]
    constructionDelayMonths: 0, permitDelayDays: 0, protestRate: 0.3,
    partnerWithdraws: null, skillsShortage: false, festivalBoom: false,
  };

  function annuity(P, r, n) { return P * r / (1 - Math.pow(1 + r, -n)); }
  function debtServiceFor(c, W) {
    const P = (c.debtMUSD != null ? c.debtMUSD * 1e6 : W.debt);
    if (c.wave === 1) return c.opYear <= 2 ? P * c.interestRate : annuity(P, c.interestRate, 10); // 2-yr grace
    return annuity(P, c.interestRate, 12);
  }

  function runYear(cfgIn, seed) {
    const c = Object.assign({}, DEFAULTS, cfgIn || {});
    c.wave = +c.wave; c.opYear = +c.opYear;
    const W = WAVES[c.wave];
    const r = rng(seed == null ? 1 : seed);
    const pois = (lam) => { const L = Math.exp(-lam); let k = 0, p = 1; do { k++; p *= r(); } while (p > L); return k - 1; };
    const uni = (a, b) => a + (b - a) * r();
    const yf = YEAR_FACTOR[Math.min(Math.max(c.opYear, 1), 5) - 1];
    const ds = debtServiceFor(c, W);
    const solarMW = c.partnerWithdraws === 'energy' ? 0 : (c.solarMW != null ? +c.solarMW : W.solarMW);
    const batteryMWh = c.partnerWithdraws === 'energy' ? 0 : (c.batteryMWh != null ? +c.batteryMWh : W.batteryMWh);
    const housingUnits = c.housingUnits != null ? +c.housingUnits : W.housingUnits;
    const crewUnits = Math.round(housingUnits * (W.crewUnits / W.housingUnits));
    const shuttles = c.shuttles != null ? +c.shuttles : W.shuttles;

    const N = W.stages;
    const HORIZON = 365 + 140;
    const cal = Array.from({ length: N }, () => new Array(HORIZON).fill(null));
    const events = [];
    const ev = (day, type, persona, text) => events.push({ day, month: monthOf(Math.min(day, 364)), type, persona, text });
    const m = MONTHS.map(() => ({ stageDays: 0, intlStageDays: 0, localStageDays: 0, stageRev: 0, turnaways: 0, floodDays: 0,
      outageDays: 0, dieselMWh: 0, unservedMWh: 0, importedCrewDays: 0, overflowPersonDays: 0, lateArrivals: 0, incidents: 0, cost: 0 }));

    // ---------- Production arrivals and bookings ----------
    const intlLam = W.intlRate * yf * c.intlDemandMult * (c.rebate ? 1.5 : 1);
    const seasonW = (mo) => (mo >= 4 && mo <= 9) ? 1.25 : 0.75; // productions prefer the dry season
    const prods = [];
    const nIntl = pois(intlLam);
    for (let i = 0; i < nIntl; i++) {
      let day; do { day = Math.floor(r() * 365); } while (r() > seasonW(monthOf(day)) / 1.25);
      const series = r() < 0.35;
      prods.push({ id: 'I' + i, kind: 'intl', day, stages: 1 + Math.floor(r() * 3), len: Math.round(uni(25, 70)), series, name: series ? 'series' : 'feature' });
    }
    if (c.anchor) prods.push({ id: 'A', kind: 'anchor', day: 45, stages: 2, len: 150, series: true, name: 'anchor-tenant series' });
    const nLocal = pois(W.localRate * yf);
    for (let i = 0; i < nLocal; i++) prods.push({ id: 'L' + i, kind: 'local', day: Math.floor(r() * 365), stages: 1, len: Math.round(uni(4, 15)), name: 'local production' });
    prods.sort((a, b) => ((b.kind === 'anchor') - (a.kind === 'anchor')) || a.day - b.day);

    const openDay = Math.round(Math.max(0, c.constructionDelayMonths * 30.4 + c.permitDelayDays));
    if (openDay > 0) ev(0, 'bad', 'line producer', `Site not ready until day ${openDay} (${MONTHS[monthOf(Math.min(openDay, 364))]}): ${c.constructionDelayMonths ? 'construction delay' : 'permit delay'}; early bookings must move or cancel`);
    let lostIntl = 0, lostLocal = 0, bookedIntl = 0, bookedLocal = 0, visaDelays = 0, renewals = 0;
    for (const p of prods) {
      let start = Math.max(p.day, openDay);
      if (p.kind !== 'local' && r() < 0.25) { const d = Math.round(uni(3, 14)); start += d; visaDelays++;
        if (r() < 0.3) ev(Math.min(364, Math.floor(start)), 'warn', 'line producer', `Work visas for an international ${p.name} arrive ${d} days late; the shoot slides`); }
      let placed = false;
      for (let slip = 0; slip <= (p.kind === 'local' ? 5 : 14) && !placed; slip++) {
        const s0 = Math.floor(start + slip);
        if (s0 >= 365) break;
        const free = [];
        for (let k = 0; k < N && free.length < p.stages; k++) {
          let ok = true; for (let d = s0; d < s0 + p.len && d < HORIZON; d++) if (cal[k][d]) { ok = false; break; }
          if (ok) free.push(k);
        }
        if (free.length >= p.stages) {
          for (const k of free) for (let d = s0; d < s0 + p.len && d < HORIZON; d++) cal[k][d] = p;
          p.start = s0; placed = true;
        }
      }
      if (!placed) {
        const day = Math.min(364, Math.floor(start));
        m[monthOf(day)].turnaways++;
        if (p.kind === 'local') lostLocal++;
        else { lostIntl++; ev(day, 'bad', 'line producer', `No ${p.stages} free stage${p.stages > 1 ? 's' : ''} for ${p.len} days: an international ${p.name} books elsewhere`); }
      } else {
        if (p.kind === 'local') bookedLocal++; else bookedIntl++;
        if (p.kind === 'anchor') ev(p.start, 'good', 'gaffer', `The anchor tenant's series moves onto 2 stages for ${p.len} days`);
        if (p.series && p.kind === 'intl' && r() < 0.3) {
          const s0 = p.start + p.len + 30, len = 45;
          if (s0 < 365) {
            const k = cal.findIndex(row => row.slice(s0, Math.min(HORIZON, s0 + len)).every(x => !x));
            if (k >= 0) { for (let d = s0; d < Math.min(HORIZON, s0 + len); d++) cal[k][d] = p; renewals++;
              ev(s0, 'good', 'student', 'A series renews for another 45-day block; trainees join it on set'); }
          }
        }
      }
    }

    // ---------- Daily loop ----------
    const crewPool = W.crewPool0 + c.gradsPerYear * (c.opYear - 1) * (c.skillsShortage ? 0.4 : 1);
    const skilled0 = W.skilled0 * (c.skillsShortage ? 0.6 : 1) + c.gradsPerYear * 0.15 * (c.opYear - 1) * (c.skillsShortage ? 0.4 : 1);
    let kwanzaIdx = 1.0; const dailyDrift = Math.pow(1 - c.kwanzaDrift, 1 / 365);
    const shockDay = c.kwanzaShock > 0 ? Math.floor(uni(60, 240)) : -1;
    let battery = batteryMWh * 0.5, outageLeft = 0, protestLeft = 0, malariaLeft = 0;
    let floodDays = 0, outageDays = 0, dieselDays = 0, unservedEvents = 0, totalDemand = 0, totalUnserved = 0, dieselMWh = 0, solarTotal = 0;
    let incidentsCost = 0, theft = 0, accidents = 0, protests = 0, waterDays = 0, importedCrewDays = 0, overflowDays = 0, maxOverflow = 0, lateArrivals = 0;
    const outRate = c.outagesPerYear / 365 * (c.gridFailures ? 3 : 1);
    const outMax = c.gridFailures ? 5 : 3;
    let stageDaysIntl = 0, stageDaysLocal = 0;
    const crewBeds = crewUnits * c.unitsPerson;
    const trace = [];
    let firstFloodStory = false, firstOverflowStory = false, firstLateStory = false;

    for (let d = 0; d < 365; d++) {
      const mo = monthOf(d), M = m[mo];
      const rainy = mo >= 10 || mo <= 3;
      const peak = mo === 2 || mo === 3 || mo === 10; // Mar, Apr, Nov – to be verified by Research
      kwanzaIdx *= dailyDrift * (1 + (r() - 0.5) * 0.004);
      if (d === shockDay) { kwanzaIdx *= (1 - c.kwanzaShock);
        ev(d, 'bad', 'artisan', `The kwanza falls ${Math.round(c.kwanzaShock * 100)}% in a week; market prices lag until the next quarterly reset`); }
      const pFlood = rainy ? (peak ? 0.07 : 0.03) * c.rainIntensity : 0.002;
      const flood = r() < pFlood;
      if (flood) { floodDays++; M.floodDays++; M.cost += 40000; incidentsCost += 40000;
        if (!firstFloodStory) { firstFloodStory = true; ev(d, 'warn', 'trainee', 'Heavy rain floods the access road; the shuttle runs half-empty and the morning class starts late'); }
        if (r() < 0.06 * Math.max(1, c.rainIntensity)) { M.cost += 150000; incidentsCost += 150000; ev(d, 'bad', 'gaffer', 'Flood water reaches the backlot store: about USD 150k of gear damaged'); } }
      let active = 0, activeIntl = 0; const occ = [];
      for (let k = 0; k < N; k++) { const p = d >= openDay ? cal[k][d] : null; occ.push(p ? (p.kind === 'local' ? 1 : 2) : 0); if (p) { active++; if (p.kind !== 'local') activeIntl++; } }
      if (protestLeft === 0 && r() < (c.protestRate * (c.permitDelayDays > 0 ? 2.5 : 1)) / 365) { protestLeft = 1 + Math.floor(r() * 2); protests++;
        ev(d, 'bad', 'trainee', 'Community protest at the main gate over local hiring; trucks and the shuttle wait outside'); }
      const protest = protestLeft > 0;
      if (protest) { protestLeft--; M.cost += 25000; incidentsCost += 25000; }
      const revIntl = activeIntl * c.intlRate, revLocal = (active - activeIntl) * c.localRate * keep();
      stageDaysIntl += activeIntl; stageDaysLocal += active - activeIntl;
      M.stageDays += active; M.intlStageDays += activeIntl; M.localStageDays += active - activeIntl; M.stageRev += revIntl + revLocal;
      // crew
      if (rainy && malariaLeft === 0 && r() < 0.012) { malariaLeft = 14; ev(d, 'warn', 'gaffer', 'Malaria spike: about 1 in 10 local crew off sick for two weeks'); }
      const sick = malariaLeft > 0 ? 0.9 : 1; if (malariaLeft > 0) malariaLeft--;
      const poolToday = crewPool * sick * (flood ? 0.75 : 1);
      const skilledPool = skilled0 * sick;
      const imported = Math.max(0, active * c.crewPerStage - poolToday) + Math.max(0, activeIntl * 16 - skilledPool);
      importedCrewDays += imported; M.importedCrewDays += imported;
      const overflow = Math.max(0, imported - crewBeds);
      overflowDays += overflow; M.overflowPersonDays += overflow; maxOverflow = Math.max(maxOverflow, overflow);
      M.cost += overflow * 40;
      if (overflow > 0 && !firstOverflowStory) { firstOverflowStory = true; ev(d, 'warn', 'hotel worker', `Crew housing is full: ${Math.round(overflow)} imported crew are lodged at airport-area hotels and bussed in`); }
      // commuting: local crew working + day students, shuttle seats 60 x 3 runs
      const commuters = Math.min(poolToday, active * c.crewPerStage) + (W.students * 0.6) * (d % 7 < 5 ? 1 : 0.2);
      const seats = shuttles * 60 * 3 * (flood ? 0.5 : 1) * (protest ? 0.5 : 1);
      const late = Math.max(0, commuters - seats);
      lateArrivals += late; M.lateArrivals += late;
      if (late > 50 && !firstLateStory) { firstLateStory = true; ev(d, 'warn', 'trainee', `${Math.round(late)} people miss their shuttle; minibus taxis from Cacuaco and Viana fill the gap`); }
      // power
      const demand = W.baseLoadMWh + active * 6 + (c.wave >= 2 ? W.students * 0.004 : 0);
      totalDemand += demand;
      let yieldK = (mo >= 5 && mo <= 8) ? 3.9 : 4.9; // kWh/kWp/day; dry overcast Jun–Sep lower – to be verified
      if (rainy && r() < 0.35) yieldK *= 0.6;
      const solar = solarMW * yieldK; solarTotal += solar;
      const dayDemand = demand * 0.6, eveDemand = demand * 0.4;
      const surplus = solar - dayDemand, shortDay = Math.max(0, -surplus);
      battery = Math.min(batteryMWh * 0.9, battery + Math.max(0, surplus) * 0.92);
      const fromBatt = Math.min(battery, eveDemand); battery -= fromBatt;
      const need = shortDay + (eveDemand - fromBatt);
      let outage = false, diesel = 0, unserved = 0;
      if (outageLeft === 0 && r() < outRate) { outageLeft = 1 + Math.floor(r() * outMax);
        if (need > 0 || solarMW === 0) ev(d, 'warn', 'gaffer', `Grid outage for ${outageLeft} day${outageLeft > 1 ? 's' : ''}; diesel generators start`); }
      if (outageLeft > 0) { outageLeft--; outageDays++; M.outageDays++; outage = true;
        if (need > 0) { dieselDays++;
          if (r() > 0.03) { diesel = need; dieselMWh += need; M.dieselMWh += need; const cost = need * 1000 * (c.dieselPrice - c.ppaPrice); M.cost += cost; incidentsCost += cost; }
          else { unserved = need; totalUnserved += need; M.unservedMWh += need; unservedEvents++; ev(d, 'bad', 'gaffer', 'Diesel back-up fails during a grid outage: power lost on set for several hours'); } } }
      // incidents
      if (r() < 0.004 + active * 0.0005) { const v = uni(30000, 150000); theft++; M.cost += v; incidentsCost += v; M.incidents++;
        ev(d, 'bad', 'gaffer', `Gear stolen from the rental house: about USD ${Math.round(v / 1000)}k`); }
      for (let k = 0; k < active; k++) if (r() < 0.0015) { accidents++; M.cost += 50000; incidentsCost += 50000; M.incidents++;
        ev(d, 'bad', 'gaffer', 'Set accident: a rigging failure injures one crew member; the stage closes for a safety review'); }
      if (mo >= 7 && mo <= 9 && r() < 0.012 * (c.rainIntensity < 0.8 ? 2 : 1)) { waterDays++; M.cost += 8000; incidentsCost += 8000;
        if (waterDays === 1) ev(d, 'warn', 'hotel worker', 'Dry-season water shortage: tankers truck water to housing and the stages'); }
      if (c.festivalBoom && d === 200) ev(d, 'good', 'artisan', 'Festival week sells out; market stalls take a month of sales in seven days');
      if (!c.festivalBoom && d === 200 && W.festival > 0) ev(d, 'good', 'artisan', 'Festival week brings the busiest days of the year to the artisan market');
      trace.push({ d, mo, occ, flood, outage, diesel: Math.round(diesel), unserved: Math.round(unserved), battery: batteryMWh ? battery / (batteryMWh * 0.9) : 0,
        solar: Math.round(solar), demand: Math.round(demand), imported: Math.round(imported), overflow: Math.round(overflow), late: Math.round(late), protest });
    }
    function keep() { const loss = 1 - kwanzaIdx; return 1 - loss * (1 - c.indexRecovery); }
    const aoaKeep = keep();
    if (c.opYear >= 2) ev(150, 'good', 'student', `${Math.round(c.gradsPerYear * (c.skillsShortage ? 0.4 : 1))} academy graduates join the local crew pool this year`);

    // ---------- Annual lines ----------
    const stageRev = m.reduce((s, x) => s + x.stageRev, 0);
    const intlStageRev = stageDaysIntl * c.intlRate;
    const rental = W.rentalOffsite * yf * (0.85 + 0.3 * r()) + 0.30 * stageRev;
    const post = W.postBase * yf + 0.20 * intlStageRev;
    const studentsN = W.students * Math.min(1, 0.6 + 0.1 * c.opYear);
    const education = studentsN * c.feePerStudent * (0.2 + 0.8 * aoaKeep);
    const crewOcc = Math.min(1, (importedCrewDays / 365) / Math.max(1, crewUnits * c.unitsPerson) * 0.9 + 0.35);
    const housing = (housingUnits - crewUnits) * c.rentPerUnit * 0.93 * (0.3 + 0.7 * aoaKeep) + crewUnits * c.rentPerUnit * 1.6 * crewOcc;
    const visitors = W.visitors * yf * (c.festivalBoom ? 1.6 : 1) * (0.85 + 0.3 * r());
    const tourism = visitors * W.visitorSpend * (0.3 + 0.7 * aoaKeep) + W.festival * (c.festivalBoom ? 2 : 1);
    const hotel = c.partnerWithdraws === 'hotel' ? 0 : W.hotelLease * yf;
    if (c.partnerWithdraws === 'hotel' && c.wave >= 2) ev(30, 'bad', 'hotel worker', 'The hotel operator pulls out; hotel 1 stands empty and its lease income stops');
    if (c.partnerWithdraws === 'energy') ev(5, 'bad', 'gaffer', 'The energy partner withdraws before the solar plant is built; the site runs on grid and diesel');
    const leases = W.tenantLeases;
    const revenue = stageRev + rental + post + education + housing + tourism + hotel + leases;
    const badDebt = (stageDaysLocal * c.localRate) * 0.05;
    const extraPower = c.partnerWithdraws === 'energy' ? (totalDemand - dieselMWh) * 1000 * 0.04 : 0; // grid premium over PPA
    const fixed = W.fixedOpex * (c.wave === 1 && c.opYear === 1 ? 0.85 : 1) * (1 - (1 - aoaKeep) * 0.25);
    const opex = fixed + c.variableCostShare * revenue + incidentsCost + badDebt + extraPower;
    const ebitda = revenue - opex;
    const cfads = ebitda - c.sustainingCapex * revenue - Math.max(0, ebitda) * c.taxRate;
    const dscr = cfads / ds;

    // zone stress 0 (fine) .. 1 (failing), for the map
    const occRate = (stageDaysIntl + stageDaysLocal) / (N * 365);
    const stress = {
      film: Math.min(1, lostIntl / Math.max(2, nIntl) * 1.6 + Math.max(0, 0.45 - occRate) * 1.5),
      energy: Math.min(1, (totalUnserved > 0 ? 0.6 : 0) + dieselMWh / Math.max(1, totalDemand) * 6 + (solarMW === 0 ? 0.5 : 0)),
      housing: Math.min(1, overflowDays / 2000 + (maxOverflow > 0 ? 0.25 : 0)),
      education: Math.min(1, lateArrivals / 20000 + (c.skillsShortage ? 0.3 : 0)),
      tourism: Math.min(1, Math.max(0, 1 - aoaKeep) * 2 + (c.partnerWithdraws === 'hotel' ? 0.6 : 0)),
      infra: Math.min(1, floodDays / 25 + protests * 0.15 + waterDays / 20),
      tech: Math.min(1, Math.max(0, 0.6 - dscr) * 0.5),
    };

    return {
      seed, config: c, revenue, ebitda, margin: ebitda / revenue, cfads, debtService: ds, dscr,
      lines: { stageRev, rental, post, education, housing, tourism, hotel, leases },
      stageOccupancy: occRate, intlArrived: nIntl, intlBooked: bookedIntl, intlLost: lostIntl, localBooked: bookedLocal, localLost: lostLocal,
      visaDelays, renewals, floodDays, outageDays, dieselDays, dieselMWh, unservedEvents,
      powerReliability: 1 - totalUnserved / totalDemand, solarShare: Math.min(1, solarTotal / totalDemand), demandGWh: totalDemand / 1000, solarGWh: solarTotal / 1000,
      students: Math.round(studentsN), visitors: Math.round(visitors), importedCrewDays: Math.round(importedCrewDays),
      housingOverflowPersonDays: Math.round(overflowDays), maxOverflow: Math.round(maxOverflow), lateArrivals: Math.round(lateArrivals),
      theft, accidents, protests, waterDays, incidentsCost, kwanzaEnd: kwanzaIdx, aoaKeep, openDay,
      stages: N, housingUnits, solarMW, batteryMWh, shuttles, stress,
      monthly: m.map((x, i) => Object.assign({ month: MONTHS[i] }, x, { occ: x.stageDays / (N * MONTH_DAYS[i]) })),
      events: events.sort((a, b) => a.day - b.day),
      trace,
    };
  }

  function monteCarlo(cfg, n, seed0) {
    n = n || 200; seed0 = seed0 == null ? 1000 : seed0;
    const runs = []; for (let i = 0; i < n; i++) { const r = runYear(cfg, seed0 + i); delete r.trace; runs.push(r); }
    const q = (arr, p) => { const s = arr.slice().sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]; };
    const sum = { n };
    for (const k of ['revenue', 'ebitda', 'margin', 'dscr', 'stageOccupancy', 'intlLost', 'floodDays', 'powerReliability',
      'importedCrewDays', 'housingOverflowPersonDays', 'outageDays', 'lateArrivals', 'incidentsCost']) {
      const a = runs.map(x => x[k]); sum[k] = { p10: q(a, 0.1), p50: q(a, 0.5), p90: q(a, 0.9), mean: a.reduce((s, v) => s + v, 0) / a.length };
    }
    sum.pDscrBelow13 = runs.filter(x => x.dscr < 1.3).length / n;
    sum.pDscrBelow10 = runs.filter(x => x.dscr < 1.0).length / n;
    const tests = [
      ['International booking turned away', x => x.intlLost > 0],
      ['Equipment theft', x => x.theft > 0],
      ['Set accident', x => x.accidents > 0],
      ['Diesel needed in a grid outage', x => x.dieselDays > 0],
      ['Power lost on set', x => x.unservedEvents > 0],
      ['Crew lodged off site (housing full)', x => x.housingOverflowPersonDays > 0],
      ['People miss the shuttle', x => x.lateArrivals > 500],
      ['Community protest at the gate', x => x.protests > 0],
      ['Dry-season water shortage', x => x.waterDays > 0],
      ['10+ flood days', x => x.floodDays >= 10],
    ];
    sum.problemFrequency = tests.map(([k, f]) => [k, runs.filter(f).length / n]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
    sum.dscrValues = runs.map(x => x.dscr);
    return { summary: sum, runs };
  }

  return { runYear, monteCarlo, WAVES, DEFAULTS, MONTHS, version: '1.0' };
});
