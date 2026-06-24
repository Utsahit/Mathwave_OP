import net from 'net';

function checkPort(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function warmup() {
  const ports = [5432, 6379];
  const host = '127.0.0.1';
  console.log(`Warming up WSL2 ports: ${ports.join(', ')}...`);

  for (const port of ports) {
    let success = false;
    for (let attempt = 1; attempt <= 30; attempt++) {
      success = await checkPort(port, host);
      if (success) {
        console.log(`✅ Port ${port} is warm and accepting connections!`);
        break;
      }
      console.log(`[Attempt ${attempt}/30] Port ${port} is cold, retrying in 1s...`);
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!success) {
      console.error(`❌ Port ${port} failed to warm up after 30 attempts.`);
      process.exit(1);
    }
  }
  console.log('✅ All ports warmed up successfully!');
  process.exit(0);
}

warmup();
