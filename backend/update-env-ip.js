const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  console.log('Resolving WSL IP address...');
  const output = execSync('wsl -d Ubuntu hostname -I', { encoding: 'utf8' }).trim();
  const ip = output.split(' ')[0];
  if (!ip) {
    throw new Error('No IP address returned from WSL.');
  }
  console.log(`WSL IP found: ${ip}`);

  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, 'utf8');
    let updated = content;
    
    // Regex matches postgresql url format postgresql://user:pass@host:port/db?schema=public
    updated = updated.replace(/DATABASE_URL="postgresql:\/\/([^@:]+):([^@:]+)@[^:/]+(:[0-9]+)?\/([^?"]+)(\?[^"]+)?"/, (match, user, pass, port, db, query) => {
      const p = port || ':5432';
      const q = query || '';
      return `DATABASE_URL="postgresql://${user}:${pass}@${ip}${p}/${db}${q}"`;
    });
    
    updated = updated.replace(/REDIS_URL="redis:\/\/([^:/]+)(:[0-9]+)?"/, (match, host, port) => {
      const p = port || ':6379';
      return `REDIS_URL="redis://${ip}${p}"`;
    });
    
    if (content !== updated) {
      fs.writeFileSync(envPath, updated, 'utf8');
      console.log('Successfully updated .env with WSL IP address.');
    } else {
      console.log('.env is already up to date with WSL IP address.');
    }
  } else {
    console.error('.env file not found.');
  }
} catch (error) {
  console.error('Failed to update .env with WSL IP address:', error.message);
  console.log('Using default 127.0.0.1 interface.');
}
