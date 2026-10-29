// Runs on GitHub Actions every hour: fetches the forecast for every city in data/cities.json
// and writes one small file per city (data/w/<id>.json) plus data/index.json with the list.
// The app reads these files when api.open-meteo.com is unreachable from the phone.
import { readFile, writeFile, mkdir } from "node:fs/promises";

const PARAMS =
  "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m,wind_gusts_10m,wind_direction_10m,surface_pressure,precipitation" +
  "&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,precipitation_probability,uv_index,weather_code,is_day,wind_speed_10m,wind_gusts_10m,wind_direction_10m,surface_pressure" +
  "&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,sunrise,sunset,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max" +
  "&timezone=auto&forecast_days=10&wind_speed_unit=ms";
const BATCH = 40; // Open-Meteo accepts several coordinates in one request
const sleep = ms => new Promise(r => setTimeout(r, ms));

const cities = JSON.parse(await readFile("data/cities.json", "utf8"));
await mkdir("data/w", { recursive: true });
const ok = [];

for (let i = 0; i < cities.length; i += BATCH) {
  const part = cities.slice(i, i + BATCH);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${part.map(c => c.lat).join(",")}&longitude=${part.map(c => c.lon).join(",")}${PARAMS}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status + " " + (await res.text()).slice(0, 200));
      let data = await res.json();
      if (!Array.isArray(data)) data = [data];
      for (let k = 0; k < part.length; k++) {
        await writeFile(`data/w/${part[k].id}.json`, JSON.stringify(data[k]));
        ok.push(part[k]);
      }
      break;
    } catch (e) {
      console.warn(`batch ${i / BATCH + 1}: attempt ${attempt} failed: ${e.message}`);
      if (attempt === 3) process.exitCode = 1;
      else await sleep(5000 * attempt);
    }
  }
  await sleep(1500);
}

await writeFile("data/index.json", JSON.stringify({
  updated: new Date().toISOString(),
  cities: ok.map(({ id, name, region, lat, lon }) => ({ id, name, region, lat, lon }))
}));
console.log(`Saved ${ok.length} of ${cities.length} cities`);
