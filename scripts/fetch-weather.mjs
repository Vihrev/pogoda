// Runs on GitHub Actions: fetches the forecast for every city in data/cities.json
// and writes data/weather.json, which the app reads when Open-Meteo is unreachable.
import { readFile, writeFile } from "node:fs/promises";

const PARAMS =
  "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m,wind_gusts_10m,wind_direction_10m,surface_pressure,precipitation" +
  "&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,precipitation_probability,uv_index,weather_code,is_day,wind_speed_10m,wind_gusts_10m,wind_direction_10m,surface_pressure" +
  "&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,sunrise,sunset,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max" +
  "&timezone=auto&forecast_days=10&wind_speed_unit=ms";

const cities = JSON.parse(await readFile("data/cities.json", "utf8"));
const items = [];
for (const c of cities) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}${PARAMS}`);
      if (!res.ok) throw new Error("HTTP " + res.status);
      items.push({ name: c.name, lat: c.lat, lon: c.lon, data: await res.json() });
      break;
    } catch (e) {
      console.warn(`${c.name}: attempt ${attempt} failed: ${e.message}`);
      if (attempt === 3) process.exitCode = 1;
      else await new Promise(r => setTimeout(r, 3000 * attempt));
    }
  }
}
await writeFile("data/weather.json", JSON.stringify({ updated: new Date().toISOString(), items }));
console.log(`Saved ${items.length} of ${cities.length} cities`);
