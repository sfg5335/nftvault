import express from 'express';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const app = express();
const PORT = 9000;

app.use(express.json());

// GitHub webhook endpoint
app.post('/webhook/github', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  const secret = process.env.GITHUB_WEBHOOK_SECRET!;
  
  // Verify webhook signature
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
  
  if (signature !== digest) {
    return res.status(401).send('Unauthorized');
  }
  
  // Check if it's a push to main branch
  if (req.body.ref === 'refs/heads/main') {
    console.log('Deploying from GitHub push...');
    
    try {
      // Pull latest changes
      await execAsync('cd /root/nftvault && git pull origin main');
      
      // Install dependencies and build
      await execAsync('cd /root/nftvault && npm install && npm run build');
      await execAsync('cd /root/nftvault/backend && npm install && npm run build');
      
      // Restart services
      await execAsync('pm2 restart all');
      
      console.log('Deployment successful!');
      res.status(200).send('Deployment triggered');
    } catch (error) {
      console.error('Deployment failed:', error);
      res.status(500).send('Deployment failed');
    }
  } else {
    res.status(200).send('Not main branch, ignoring');
  }
});

app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
}); 