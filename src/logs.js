// یه بافر ساده‌ی حافظه‌ای برای نگهداری آخرین رویدادها، تا داشبورد وب بتونه
// وضعیت زنده‌ی فورواردر رو نشون بده.

const MAX_LOGS = 200;
let logs = [];

function log(line) {
  const time = new Date().toLocaleTimeString("fa-IR", { hour12: false });
  logs.push({ time, line });
  if (logs.length > MAX_LOGS) logs.shift();
  console.log(`[${time}] ${line}`);
}

function getLogs() {
  return logs;
}

module.exports = { log, getLogs };
