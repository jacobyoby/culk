import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Docker Integration', () => {
  describe('Development Container', () => {
    it('should build development image successfully', async () => {
      const { stdout, stderr } = await execAsync(
        'docker build -t ai-cull:dev-test -f Dockerfile.dev --target development .'
      );
      
      expect(stderr).not.toContain('ERROR');
      expect(stdout).toContain('Successfully tagged');
    }, 60000);

    it('should start dev container with hot reload', async () => {
      const { stdout } = await execAsync(
        'docker run -d --name ai-cull-dev-test -p 3002:3000 ai-cull:dev-test'
      );
      
      expect(stdout).toBeTruthy();
      
      await execAsync('docker stop ai-cull-dev-test && docker rm ai-cull-dev-test');
    }, 30000);
  });

  describe('Production Container', () => {
    it('should build production image with multi-stage', async () => {
      const { stdout, stderr } = await execAsync(
        'docker build -t ai-cull:prod-test -f Dockerfile .'
      );
      
      expect(stderr).not.toContain('ERROR');
      expect(stdout).toContain('Successfully tagged');
    }, 120000);

    it('should pass healthcheck within 30 seconds', async () => {
      const { stdout: containerId } = await execAsync(
        'docker run -d --name ai-cull-prod-test -p 3003:3000 ai-cull:prod-test'
      );
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const { stdout: health } = await execAsync(
        'docker inspect --format="{{.State.Health.Status}}" ai-cull-prod-test'
      );
      
      expect(health.trim()).toBe('healthy');
      
      await execAsync('docker stop ai-cull-prod-test && docker rm ai-cull-prod-test');
    }, 40000);

    it('should have minimal image size', async () => {
      const { stdout } = await execAsync(
        'docker images ai-cull:prod-test --format "{{.Size}}"'
      );
      
      const sizeStr = stdout.trim();
      const sizeMatch = sizeStr.match(/(\d+(?:\.\d+)?)(MB|GB)/);
      
      if (sizeMatch) {
        const [, value, unit] = sizeMatch;
        const sizeInMB = unit === 'GB' ? parseFloat(value) * 1024 : parseFloat(value);
        expect(sizeInMB).toBeLessThan(500);
      }
    });
  });

  describe('Docker Compose', () => {
    it('should start all services with docker-compose', async () => {
      const { stdout, stderr } = await execAsync(
        'docker compose -f docker-compose.test.yml up -d'
      );
      
      expect(stderr).not.toContain('ERROR');
      
      const { stdout: ps } = await execAsync('docker compose -f docker-compose.test.yml ps');
      expect(ps).toContain('ai-cull-app-test');
      
      await execAsync('docker compose -f docker-compose.test.yml down');
    }, 60000);
  });
});