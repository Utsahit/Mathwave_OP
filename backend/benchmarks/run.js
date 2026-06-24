const autocannon = require('autocannon');
const { PassThrough } = require('stream');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const DURATION = 10;
const CONNECTIONS = 10;

function runBenchmark(name, opts) {
  return new Promise((resolve, reject) => {
    const instance = autocannon({
      url: BASE_URL,
      duration: DURATION,
      connections: CONNECTIONS,
      ...opts,
    }, (err, result) => {
      if (err) return reject(err);
      console.log(`\n==== ${name} ====`);
      console.log(`  Requests:   ${result.requests.total}`);
      console.log(`  Latency p50: ${result.latency.p50} ms`);
      console.log(`  Latency p95: ${result.latency.p95} ms`);
      console.log(`  Latency p99: ${result.latency.p99} ms`);
      console.log(`  Errors:     ${result.errors}`);
      console.log(`  Throughput: ${(result.throughput.total / 1024 / 1024).toFixed(2)} MB`);
      resolve(result);
    });
    process.stdout.write(`Running: ${name}...`);
    instance.on('tick', () => process.stdout.write('.'));
    instance.on('done', () => process.stdout.write(' done\n'));
  });
}

async function main() {
  console.log(`Benchmarking ${BASE_URL} (${DURATION}s, ${CONNECTIONS} connections)\n`);

  // Warmup
  await runBenchmark('Warmup', { method: 'GET', path: '/health' });

  // Public Menu
  await runBenchmark('GET /menu/public', { method: 'GET', path: '/api/v1/menu/public' });

  // Menu Items
  await runBenchmark('GET /menu/items', { method: 'GET', path: '/api/v1/menu/items' });

  // Reviews
  await runBenchmark('GET /reviews', { method: 'GET', path: '/api/v1/reviews' });

  // Reservations Availability
  await runBenchmark('GET /reservations/availability', {
    method: 'GET',
    path: '/api/v1/reservations/availability?date=2026-06-25&guests=2',
  });

  // Analytics Dashboard
  await runBenchmark('GET /analytics/dashboard', { method: 'GET', path: '/api/v1/analytics/dashboard' });

  // Health
  await runBenchmark('GET /health', { method: 'GET', path: '/health' });

  // Readiness
  await runBenchmark('GET /ready', { method: 'GET', path: '/ready' });

  console.log('\nAll benchmarks complete.');
}

main().catch(console.error);
