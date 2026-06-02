import fs from 'fs';
import path from 'path';

const peerFile = path.join('node_modules', 'slsk-client', 'lib', 'peer', 'default-peer.js');

if (!fs.existsSync(peerFile)) {
  console.log('slsk-client not installed, skipping patch');
  process.exit(0);
}

let content = fs.readFileSync(peerFile, 'utf-8');

// Patch QueueFailed (case 50) to call callback with error instead of silently dropping
if (!content.includes('downQ')) {
  content = content.replace(
    `case 50: {
          let filename = msg.str()
          let reason = msg.str()
          debug(\`\${peer.user} QueueFailed \${filename} reason \${reason}\`)
          break
        }`,
    `case 50: {
          let filename = msg.str()
          let reason = msg.str()
          debug(\`\${peer.user} QueueFailed \${filename} reason \${reason}\`)
          let downQ = stack.download[peer.user + '_' + filename]
          if (downQ && typeof downQ.cb === 'function') {
            downQ.cb(new Error('Queue failed: ' + reason))
            delete stack.download[peer.user + '_' + filename]
          }
          break
        }`
  );
  fs.writeFileSync(peerFile, content);
  console.log('Patched slsk-client: QueueFailed now calls callback');
} else {
  console.log('slsk-client already patched');
}
