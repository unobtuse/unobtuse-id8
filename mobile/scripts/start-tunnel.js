const {
    spawn
} = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting Expo Tunnel...');

const expo = spawn('npx', ['expo', 'start', '--tunnel', '--clear'], {
    cwd: path.join(__dirname, '..'),
    shell: true,
    stdio: 'inherit'
});

let urlFound = false;

expo.stdout.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(output); // Pipe to console

    if (!urlFound) {
        const match = output.match(/exp:\/\/[\w-]+\.exp\.direct/);
        if (match) {
            const url = match[0];
            console.log(`\n\nTunnel URL found: ${url}`);

            const configPath = path.join(__dirname, '../../web/expo-config.json');
            const config = {
                expoUrl: url,
                updatedAt: new Date().toISOString()
            };

            try {
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                console.log(`Saved URL to ${configPath}\n`);
                urlFound = true;
            } catch (err) {
                console.error('Error saving config:', err);
            }
        }
    }
});

expo.stderr.on('data', (data) => {
    process.stderr.write(data);
});

expo.on('close', (code) => {
    console.log(`Expo process exited with code ${code}`);
});